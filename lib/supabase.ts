import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type ClaimType = "fact" | "value" | "policy";
export type StanceType = "supports" | "contradicts";
export type ReplyStatus = "pending" | "accepted" | "rejected";

export interface Profile {
  id: string;
  display_name: string | null;
  created_at: string;
}

export interface Claim {
  id: string;
  text: string;
  claim_type: ClaimType;
  author_id: string;
  created_at: string;
  author?: Profile;
  reply_count?: number;
}

export interface Reply {
  id: string;
  parent_claim_id: string;
  text: string;
  stance: StanceType;
  status: ReplyStatus;
  rejection_reason: string | null;
  author_id: string;
  created_at: string;
  author?: Profile;
  thread_id?: string;
}

export interface Thread {
  id: string;
  reply_id: string;
  claim_owner_id: string;
  reply_author_id: string;
  created_at: string;
}

export interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender?: Profile;
}
