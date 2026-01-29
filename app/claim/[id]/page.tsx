import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import ReplySection from "./ReplySection";

interface PageProps {
  params: { id: string };
}

export default async function ClaimPage({ params }: PageProps) {
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

  // Fetch claim with author info
  const { data: claim } = await supabase
    .from("claims")
    .select(
      `
      *,
      profiles (display_name)
    `,
    )
    .eq("id", params.id)
    .single();

  if (!claim) {
    notFound();
  }

  // Fetch replies with author info and thread info
  const { data: replies } = await supabase
    .from("replies")
    .select(
      `
      *,
      profiles (display_name),
      threads (id)
    `,
    )
    .eq("parent_claim_id", params.id)
    .order("created_at", { ascending: true });

  // Group replies by status
  const repliesByStatus = {
    accepted: replies?.filter((r) => r.status === "accepted") || [],
    pending: replies?.filter((r) => r.status === "pending") || [],
    rejected: replies?.filter((r) => r.status === "rejected") || [],
  };

  const isClaimOwner = session?.user?.id === claim.author_id;

  const claimTypeColors: Record<string, string> = {
    fact: "bg-blue-100 text-blue-800",
    value: "bg-purple-100 text-purple-800",
    policy: "bg-green-100 text-green-800",
  };

  const stanceColors: Record<string, string> = {
    supports: "bg-green-100 text-green-800",
    contradicts: "bg-red-100 text-red-800",
  };

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    accepted: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        href="/"
        className="text-sm text-gray-600 hover:text-gray-900 mb-6 inline-block"
      >
        ← Back to claims
      </Link>

      {/* Claim Card */}
      <div className="border rounded-lg p-6 bg-white mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span
            className={`px-2.5 py-1 text-xs rounded ${claimTypeColors[claim.claim_type] || "bg-gray-100"}`}
          >
            {claim.claim_type}
          </span>
          <span className="text-sm text-gray-600">
            by {claim.profiles?.display_name || "Anonymous"}
          </span>
          <span className="text-sm text-gray-400">
            {formatDistanceToNow(new Date(claim.created_at), {
              addSuffix: true,
            })}
          </span>
        </div>
        <p className="text-xl text-gray-900">{claim.text}</p>
      </div>

      {/* Reply Section */}
      <ReplySection
        claimId={params.id}
        claimOwnerId={claim.author_id}
        isLoggedIn={!!session}
        isClaimOwner={isClaimOwner}
        repliesByStatus={repliesByStatus}
        stanceColors={stanceColors}
        statusColors={statusColors}
      />
    </div>
  );
}
