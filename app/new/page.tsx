"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function NewClaimPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [text, setText] = useState("");
  const [claimType, setClaimType] = useState<"fact" | "value" | "policy">(
    "fact",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (text.length > 300) {
      setError("Claim must be 300 characters or less");
      setLoading(false);
      return;
    }

    if (text.trim().length === 0) {
      setError("Claim cannot be empty");
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

      const { data: claim, error: insertError } = await supabase
        .from("claims")
        .insert({
          text: text.trim(),
          claim_type: claimType,
          author_id: user.id,
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      router.push(`/claim/${claim.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Post a Claim</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Claim Type
          </label>
          <div className="flex gap-4">
            {[
              {
                value: "fact",
                label: "Fact",
                description: "Something that can be verified",
              },
              {
                value: "value",
                label: "Value",
                description: "A belief or opinion",
              },
              {
                value: "policy",
                label: "Policy",
                description: "A proposed course of action",
              },
            ].map((type) => (
              <label
                key={type.value}
                className={`flex-1 p-4 border rounded-lg cursor-pointer transition-colors ${
                  claimType === type.value
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="claimType"
                  value={type.value}
                  checked={claimType === type.value}
                  onChange={(e) =>
                    setClaimType(e.target.value as typeof claimType)
                  }
                  className="sr-only"
                />
                <div className="font-medium text-gray-900">{type.label}</div>
                <div className="text-sm text-gray-500">{type.description}</div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="text"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Your Claim
          </label>
          <textarea
            id="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={300}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="State your claim clearly and concisely..."
          />
          <div className="text-right text-sm text-gray-500 mt-1">
            {text.length}/300 characters
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? "Posting..." : "Post Claim"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
