# Consensus - Structured Discussion Platform

A Next.js + Supabase web app for structured public discussions where users post claims and engage in private 1-on-1 discussions to resolve disagreements.

## Features

- **Claims**: Post factual, value-based, or policy claims (max 300 chars)
- **Replies**: Reply with supporting or contradicting claims
- **Private Discussions**: Each reply opens a private thread between claim owner and reply author
- **Accept/Reject**: Claim owners can accept or reject replies with reasons
- **No Public Comment Trees**: No likes, followers, or algorithmic feeds

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript
- **Backend**: Supabase (PostgreSQL, Auth, RLS)
- **Styling**: Tailwind CSS

## Quick Start

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the database to be ready

### 2. Run Database Schema

In your Supabase project's SQL Editor, run the contents of [`supabase/schema.sql`](supabase/schema.sql):

```bash
# Copy and paste supabase/schema.sql into Supabase SQL Editor and run
```

This creates:

- Enums: `claim_type`, `stance_type`, `reply_status`
- Tables: `profiles`, `claims`, `replies`, `threads`, `messages`
- Indexes for performance
- RLS policies for security
- Auto-profile creation on signup
- Auto-thread creation on reply

### 3. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your Supabase credentials from **Settings > API**:

- `NEXT_PUBLIC_SUPABASE_URL`: Your project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your anon public key

### 4. Install Dependencies

```bash
npm install
```

### 5. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000`

## Project Structure

```
consensus/
├── app/
│   ├── layout.tsx          # Root layout with nav
│   ├── page.tsx            # Home page (list claims)
│   ├── globals.css         # Tailwind imports
│   ├── new/
│   │   └── page.tsx        # Create new claim
│   ├── claim/
│   │   └── [id]/
│   │       ├── page.tsx    # Claim detail + replies
│   │       └── ReplySection.tsx
│   ├── thread/
│   │   └── [id]/
│   │       ├── page.tsx    # Private discussion
│   │       └── ThreadView.tsx
│   └── auth/
│       ├── login/
│       │   └── page.tsx    # Sign in/up
│       ├── callback/
│       │   └── route.ts    # Auth callback
│       └── signout/
│           └── route.ts    # Sign out handler
├── lib/
│   └── supabase.ts         # Supabase client + types
├── supabase/
│   └── schema.sql          # Database schema + RLS
├── .env.example            # Environment template
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── next.config.js
```

## Database Schema

### Tables

| Table      | Description                                 |
| ---------- | ------------------------------------------- |
| `profiles` | User display names (auto-created on signup) |
| `claims`   | Public claims with type (fact/value/policy) |
| `replies`  | Claim-to-claim responses with stance        |
| `threads`  | Private discussion link per reply           |
| `messages` | Chat messages in threads                    |

### RLS Policies

- **Profiles**: Anyone can read; users edit own profile
- **Claims**: Public read; auth users create; authors edit/delete
- **Replies**: Public read; auth users create; claim owners update status
- **Threads**: Only participants can read
- **Messages**: Only participants can read/write

## Usage Flow

1. **Sign In** → Create account or sign in
2. **Post Claim** → Choose type (fact/value/policy), write claim (max 300 chars)
3. **View Claims** → Browse recent claims on home page
4. **Reply** → Respond with supporting/contradicting claim
5. **Auto-thread Created** → Private discussion opens
6. **Claim Owner Actions**:
   - Accept reply → Mark as accepted
   - Reject reply → Provide reason (shown to reply author)
7. **Private Discussion** → 1-on-1 chat between claim owner and reply author

## Environment Variables

| Variable                        | Description              |
| ------------------------------- | ------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key |

## Development

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Production Deployment

1. Set environment variables in your deployment platform
2. Run `npm run build`
3. Deploy the `app` directory

### Vercel (Recommended)

```bash
npm i -g vercel
vercel
```

### Docker

```bash
docker build -t consensus .
docker run -p 3000:3000 consensus
```

## Supabase Configuration

### Auth Settings

Enable the authentication providers you want in **Authentication > Providers**:

- Email/Password
- Magic Link (Email OTP)

### Email Templates

Configure email templates in **Authentication > Email Templates** for:

- Confirmation emails
- Password reset
- Magic link

## Limitations & Guardrails

- Claims: Max 300 characters
- Reply status: pending → accepted/rejected
- Threads: Only visible to the two participants
- No editing of published content (simplifies RLS)

## License

MIT
