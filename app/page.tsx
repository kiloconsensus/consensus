import Link from "next/link";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { formatDistanceToNow } from "date-fns";

export const dynamic = "force-dynamic";

interface ClaimWithAuthor {
  id: string;
  text: string;
  claim_type: string;
  created_at: string;
  author_id: string;
  reply_count: number;
  profiles:
    | {
        display_name: string | null;
      }
    | { display_name: string | null }[]
    | null;
}

function getDisplayName(profiles: ClaimWithAuthor["profiles"]): string {
  if (!profiles) return "Anonymous";
  if (Array.isArray(profiles)) {
    return profiles[0]?.display_name || "Anonymous";
  }
  return profiles.display_name || "Anonymous";
}

export default async function HomePage() {
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

  // Fetch claims with author info and reply count
  const { data: claims } = await supabase
    .from("claims")
    .select(
      `
      id,
      text,
      claim_type,
      created_at,
      author_id,
      profiles (display_name)
    `,
    )
    .order("created_at", { ascending: false })
    .limit(50);

  // Get reply counts for each claim
  const claimsWithCounts = await Promise.all(
    (claims || []).map(async (claim) => {
      const { count } = await supabase
        .from("replies")
        .select("*", { count: "exact", head: true })
        .eq("parent_claim_id", claim.id);

      return {
        ...claim,
        reply_count: count || 0,
      };
    }),
  );

  const claimTypeColors: Record<string, string> = {
    fact: "bg-blue-100 text-blue-800",
    value: "bg-purple-100 text-purple-800",
    policy: "bg-green-100 text-green-800",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Recent Claims</h1>
        {session && (
          <Link
            href="/new"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Post a Claim
          </Link>
        )}
      </div>

      {claimsWithCounts.length === 0 ? (
        <div className="text-center py-12 text-gray-600">
          <p className="mb-4">No claims yet. Be the first to post one!</p>
          {session ? (
            <Link
              href="/new"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Post a Claim
            </Link>
          ) : (
            <Link
              href="/auth/login"
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
            >
              Sign in to Post
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {claimsWithCounts.map((claim) => (
            <div
              key={claim.id}
              className="border rounded-lg p-4 bg-white hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-0.5 text-xs rounded ${claimTypeColors[claim.claim_type] || "bg-gray-100"}`}
                    >
                      {claim.claim_type}
                    </span>
                    <span className="text-sm text-gray-600">
                      {getDisplayName(claim.profiles)}
                    </span>
                    <span className="text-sm text-gray-400">
                      {formatDistanceToNow(new Date(claim.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <p className="text-gray-900">{claim.text}</p>
                  <div className="mt-2 text-sm text-gray-500">
                    {claim.reply_count}{" "}
                    {claim.reply_count === 1 ? "reply" : "replies"}
                  </div>
                </div>
                <Link
                  href={`/claim/${claim.id}`}
                  className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 whitespace-nowrap"
                >
                  View
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
