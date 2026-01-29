import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import ThreadView from "./ThreadView";

interface PageProps {
  params: { id: string };
}

export default async function ThreadPage({ params }: PageProps) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component - ignore
          }
        },
      },
    },
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    redirect("/auth/login");
  }

  // Fetch thread info
  const { data: thread } = await supabase
    .from("threads")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!thread) {
    notFound();
  }

  // Verify user is a participant
  if (
    thread.claim_owner_id !== session.user.id &&
    thread.reply_author_id !== session.user.id
  ) {
    redirect("/");
  }

  // Fetch reply and parent claim
  const { data: reply } = await supabase
    .from("replies")
    .select(
      `
      *,
      claims (text, claim_type, profiles(display_name))
    `,
    )
    .eq("id", thread.reply_id)
    .single();

  if (!reply) {
    notFound();
  }

  // Fetch messages
  const { data: messages } = await supabase
    .from("messages")
    .select(
      `
      *,
      profiles (display_name)
    `,
    )
    .eq("thread_id", params.id)
    .order("created_at", { ascending: true });

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href={`/claim/${reply.parent_claim_id}`}
        className="text-sm text-gray-600 hover:text-gray-900 mb-6 inline-block"
      >
        ← Back to claim
      </Link>

      {/* Context: Original claim and reply */}
      <div className="border rounded-lg p-6 bg-gray-50 mb-6">
        <div className="text-sm text-gray-600 mb-2">Original claim:</div>
        <div className="border-l-4 border-blue-500 pl-4 mb-4">
          <span
            className={`px-2 py-0.5 text-xs rounded inline-block mb-1 ${
              reply.claims.claim_type === "fact"
                ? "bg-blue-100 text-blue-800"
                : reply.claims.claim_type === "value"
                  ? "bg-purple-100 text-purple-800"
                  : "bg-green-100 text-green-800"
            }`}
          >
            {reply.claims.claim_type}
          </span>
          <p className="text-gray-900">{reply.claims.text}</p>
          <p className="text-sm text-gray-500 mt-1">
            by {reply.claims.profiles?.display_name || "Anonymous"}
          </p>
        </div>

        <div className="text-sm text-gray-600 mb-2">Reply:</div>
        <div className="border-l-4 border-gray-300 pl-4">
          <span
            className={`px-2 py-0.5 text-xs rounded inline-block mb-1 ${
              reply.stance === "supports"
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {reply.stance}
          </span>
          <p className="text-gray-900">{reply.text}</p>
        </div>
      </div>

      {/* Thread Messages */}
      <ThreadView
        threadId={params.id}
        messages={messages || []}
        currentUserId={session.user.id}
      />
    </div>
  );
}
