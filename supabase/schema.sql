-- =====================================================
-- SUPABASE SCHEMA FOR CONSENSUS DISCUSSION PLATFORM
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE claim_type AS ENUM ('fact', 'value', 'policy');
CREATE TYPE stance_type AS ENUM ('supports', 'contradicts');
CREATE TYPE reply_status AS ENUM ('pending', 'accepted', 'rejected');

-- =====================================================
-- TABLES
-- =====================================================

-- Profiles table (public user info)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Claims table
CREATE TABLE claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    text TEXT NOT NULL CHECK (LENGTH(text) <= 300),
    claim_type claim_type NOT NULL,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Replies table (claim-to-claim)
CREATE TABLE replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    stance stance_type NOT NULL,
    status reply_status DEFAULT 'pending',
    rejection_reason TEXT,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Threads table (private discussion per reply)
CREATE TABLE threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reply_id UUID NOT NULL REFERENCES replies(id) ON DELETE CASCADE,
    claim_owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reply_author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(reply_id)
);

-- Messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_claims_created_at ON claims(created_at DESC);
CREATE INDEX idx_claims_author_id ON claims(author_id);
CREATE INDEX idx_replies_parent_claim_id ON replies(parent_claim_id);
CREATE INDEX idx_replies_status ON replies(status);
CREATE INDEX idx_threads_reply_id ON threads(reply_id);
CREATE INDEX idx_messages_thread_id ON messages(thread_id);
CREATE INDEX idx_messages_created_at ON messages(created_at ASC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PROFILES RLS POLICIES
-- =====================================================

-- Anyone can read profiles
CREATE POLICY "Public profiles are viewable by everyone"
    ON profiles FOR SELECT
    USING (true);

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- =====================================================
-- CLAIMS RLS POLICIES
-- =====================================================

-- Anyone can read claims
CREATE POLICY "Claims are viewable by everyone"
    ON claims FOR SELECT
    USING (true);

-- Authenticated users can insert claims
CREATE POLICY "Authenticated users can create claims"
    ON claims FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Only author can update their claim
CREATE POLICY "Authors can update their own claims"
    ON claims FOR UPDATE
    USING (auth.uid() = author_id);

-- Only author can delete their claim
CREATE POLICY "Authors can delete their own claims"
    ON claims FOR DELETE
    USING (auth.uid() = author_id);

-- =====================================================
-- REPLIES RLS POLICIES
-- =====================================================

-- Anyone can read replies
CREATE POLICY "Replies are viewable by everyone"
    ON replies FOR SELECT
    USING (true);

-- Authenticated users can insert replies
CREATE POLICY "Authenticated users can create replies"
    ON replies FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Only claim owner can update reply status/rejection_reason
CREATE POLICY "Claim owner can update reply status"
    ON replies FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM claims
            WHERE id = parent_claim_id
            AND author_id = auth.uid()
        )
    );

-- =====================================================
-- THREADS RLS POLICIES
-- =====================================================

-- Only participants can read threads
CREATE POLICY "Participants can read threads"
    ON threads FOR SELECT
    USING (
        auth.uid() = claim_owner_id OR
        auth.uid() = reply_author_id
    );

-- Authenticated users can insert threads (with additional validation in app)
CREATE POLICY "Authenticated users can create threads"
    ON threads FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Only participants can update threads
CREATE POLICY "Participants can update threads"
    ON threads FOR UPDATE
    USING (
        auth.uid() = claim_owner_id OR
        auth.uid() = reply_author_id
    );

-- =====================================================
-- MESSAGES RLS POLICIES
-- =====================================================

-- Only participants can read messages
CREATE POLICY "Participants can read messages"
    ON messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM threads
            WHERE id = thread_id
            AND (claim_owner_id = auth.uid() OR reply_author_id = auth.uid())
        )
    );

-- Only participants can insert messages
CREATE POLICY "Participants can send messages"
    ON messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM threads
            WHERE id = thread_id
            AND (claim_owner_id = auth.uid() OR reply_author_id = auth.uid())
        )
        AND sender_id = auth.uid()
    );

-- =====================================================
-- FUNCTION TO AUTOMATICALLY CREATE PROFILE ON SIGNUP
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- FUNCTION TO AUTO-CREATE THREAD ON REPLY INSERT
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_reply()
RETURNS TRIGGER AS $$
DECLARE
    v_claim_owner_id UUID;
BEGIN
    -- Get the claim owner from the parent claim
    SELECT author_id INTO v_claim_owner_id
    FROM claims
    WHERE id = NEW.parent_claim_id;

    -- Create thread linking claim owner and reply author
    INSERT INTO threads (reply_id, claim_owner_id, reply_author_id)
    VALUES (NEW.id, v_claim_owner_id, NEW.author_id)
    ON CONFLICT (reply_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create thread when reply is inserted
DROP TRIGGER IF EXISTS on_reply_created ON replies;
CREATE TRIGGER on_reply_created
    AFTER INSERT ON replies
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_reply();

-- =====================================================
-- SEED DATA (OPTIONAL - UNCOMMENT TO USE)
-- =====================================================

-- INSERT INTO profiles (id, display_name) VALUES 
-- ('user-uuid-1', 'Alice'),
-- ('user-uuid-2', 'Bob'),
-- ('user-uuid-3', 'Charlie');

-- INSERT INTO claims (text, claim_type, author_id) VALUES
-- ('Climate change is primarily caused by human activities', 'fact', 'user-uuid-1'),
-- ('Universal basic income would improve societal well-being', 'value', 'user-uuid-2'),
-- ('Nuclear energy should be the primary energy source', 'policy', 'user-uuid-3');
