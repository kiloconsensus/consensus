"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";

interface Reply {
  id: string;
  text: string;
  stance: string;
  status: string;
  rejection_reason: string | null;
  author_id: string;
  created_at: string;
  profiles: { display_name: string | null } | null;
  threads: { id: string }[] | null;
}

interface ReplySectionProps {
  claimId: string;
  claimOwnerId: string;
  isLoggedIn: boolean;
  isClaimOwner: boolean;
  repliesByStatus: {
    accepted: Reply[];
    pending: Reply[];
    rejected: Reply[];
  };
  stanceColors: Record<string, string>;
  statusColors: Record<string, string>;
}

export default function ReplySection({
  claimId,
  claimOwnerId,
  isLoggedIn,
  isClaimOwner,
  repliesByStatus,
  stanceColors,
  statusColors,
}: ReplySectionProps) {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [stance, setStance] = useState<"supports" | "contradicts">("supports");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (replyText.trim().length === 0) {
      setError("Reply cannot be empty");
      setLoading(false);
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
        return;
      }

      const { error: insertError } = await supabase.from("replies").insert({
        parent_claim_id: claimId,
        text: replyText.trim(),
        stance,
        author_id: user.id,
      });

      if (insertError) {
        throw new Error(insertError.message);
      }

      router.refresh();
      setShowReplyForm(false);
      setReplyText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptReply = async (replyId: string) => {
    try {
      const { error } = await supabase
        .from("replies")
        .update({ status: "accepted" })
        .eq("id", replyId);

      if (error) throw error;
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleRejectReply = async (replyId: string) => {
    try {
      const { error } = await supabase
        .from("replies")
        .update({
          status: "rejected",
          rejection_reason: rejectReason.trim() || null,
        })
        .eq("id", replyId);

      if (error) throw error;
      router.refresh();
      setShowRejectModal(null);
      setRejectReason("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const renderReplyGroup = (title: string, replies: Reply[]) => (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        {title} ({replies.length})
      </h2>
      {replies.length === 0 ? (
        <p className="text-gray-500 italic">No {title.toLowerCase()} replies</p>
      ) : (
        <div className="space-y-4">
          {replies.map((reply) => (
            <div key={reply.id} className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`px-2 py-0.5 text-xs rounded ${stanceColors[reply.stance] || "bg-gray-200"}`}
                >
                  {reply.stance}
                </span>
                <span
                  className={`px-2 py-0.5 text-xs rounded ${statusColors[reply.status] || "bg-gray-200"}`}
                >
                  {reply.status}
                </span>
                <span className="text-sm text-gray-600">
                  {reply.profiles?.display_name || "Anonymous"}
                </span>
              </div>
              <p className="text-gray-900 mb-3">{reply.text}</p>

              {reply.status === "rejected" && reply.rejection_reason && (
                <p className="text-sm text-red-600 mb-3 bg-red-50 p-2 rounded">
                  Rejection reason: {reply.rejection_reason}
                </p>
              )}

              <div className="flex items-center gap-3">
                {isClaimOwner && reply.status === "pending" && (
                  <>
                    <button
                      onClick={() => handleAcceptReply(reply.id)}
                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => setShowRejectModal(reply.id)}
                      className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Reject
                    </button>
                  </>
                )}

                {/* Discussion button - for claim owner or reply author */}
                {(isClaimOwner ||
                  (isLoggedIn && reply.author_id === claimOwnerId)) && (
                  <Link
                    href={`/thread/${reply.threads?.[0]?.id}`}
                    className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-100"
                  >
                    Open Discussion
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div>
      {/* Reply Button or Form */}
      {isLoggedIn ? (
        showReplyForm ? (
          <form
            onSubmit={handleReplySubmit}
            className="border rounded-lg p-6 bg-white mb-8"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Reply to this Claim
            </h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Position
              </label>
              <div className="flex gap-4">
                {[
                  {
                    value: "supports",
                    label: "Supports",
                    description: "You agree with this claim",
                  },
                  {
                    value: "contradicts",
                    label: "Contradicts",
                    description: "You disagree with this claim",
                  },
                ].map((s) => (
                  <label
                    key={s.value}
                    className={`flex-1 p-3 border rounded cursor-pointer transition-colors ${
                      stance === s.value
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="stance"
                      value={s.value}
                      checked={stance === s.value}
                      onChange={(e) =>
                        setStance(e.target.value as typeof stance)
                      }
                      className="sr-only"
                    />
                    <div className="font-medium text-gray-900">{s.label}</div>
                    <div className="text-sm text-gray-500">{s.description}</div>
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label
                htmlFor="replyText"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Your Reply
              </label>
              <textarea
                id="replyText"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="State your supporting or contradicting claim..."
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Submitting..." : "Submit Reply"}
              </button>
              <button
                type="button"
                onClick={() => setShowReplyForm(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowReplyForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mb-8"
          >
            Reply with a Claim
          </button>
        )
      ) : (
        <div className="border rounded-lg p-6 bg-gray-50 mb-8 text-center">
          <p className="text-gray-600 mb-4">Sign in to reply to this claim</p>
          <Link
            href="/auth/login"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 inline-block"
          >
            Sign In
          </Link>
        </div>
      )}

      {/* Reply Groups */}
      {renderReplyGroup("Accepted", repliesByStatus.accepted)}
      {renderReplyGroup("Pending Review", repliesByStatus.pending)}
      {renderReplyGroup("Rejected", repliesByStatus.rejected)}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Reject Reply
            </h3>
            <p className="text-gray-600 mb-4">
              Please provide a reason for rejecting this reply. This will be
              shown to the reply author.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter rejection reason..."
            />
            <div className="flex gap-3">
              <button
                onClick={() => handleRejectReply(showRejectModal)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Reject
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(null);
                  setRejectReason("");
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
