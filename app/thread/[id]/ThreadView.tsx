"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { formatDistanceToNow } from "date-fns";

interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  profiles: { display_name: string | null } | null;
}

interface ThreadViewProps {
  threadId: string;
  messages: Message[];
  currentUserId: string;
}

export default function ThreadView({
  threadId,
  messages,
  currentUserId,
}: ThreadViewProps) {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>(messages);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to new messages
  useEffect(() => {
    const channel = supabase
      .channel(`thread:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `thread_id=eq.${threadId}`,
        },
        async (payload) => {
          // Fetch the full message with sender profile
          const { data: newMessage } = await supabase
            .from("messages")
            .select(
              `
              *,
              profiles (display_name)
            `,
            )
            .eq("id", payload.new.id)
            .single();

          if (newMessage) {
            setLocalMessages((prev) => [...prev, newMessage as Message]);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, threadId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (newMessage.trim().length === 0) {
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.from("messages").insert({
        thread_id: threadId,
        sender_id: currentUserId,
        body: newMessage.trim(),
      });

      if (error) throw error;
      setNewMessage("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border rounded-lg bg-white overflow-hidden">
      {/* Messages List */}
      <div className="h-96 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {localMessages.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <p>No messages yet. Start the discussion!</p>
          </div>
        ) : (
          localMessages.map((message) => {
            const isOwn = message.sender_id === currentUserId;
            return (
              <div
                key={message.id}
                className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg px-4 py-2 ${
                    isOwn
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-gray-200"
                  }`}
                >
                  <p className="text-sm">{message.body}</p>
                  <p
                    className={`text-xs mt-1 ${
                      isOwn ? "text-blue-200" : "text-gray-400"
                    }`}
                  >
                    {!isOwn && (message.profiles?.display_name || "Anonymous")}
                    {" · "}
                    {formatDistanceToNow(new Date(message.created_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t bg-white">
        <div className="flex gap-3">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || newMessage.trim().length === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Sending..." : "Send"}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          This is a private discussion between you and one other person.
        </p>
      </form>
    </div>
  );
}
