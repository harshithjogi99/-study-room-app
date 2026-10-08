"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinRoomPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Enter a room code first.");
      return;
    }
    router.push(`/room/${trimmed}`);
  };

  return (
    <main className="flex flex-col items-center justify-center flex-1 px-6 py-16">
      <div className="max-w-sm w-full text-center">
        <h1 className="text-3xl font-bold tracking-tight mb-3">Join a room</h1>
        <p className="text-muted text-sm mb-8">
          Paste the room code someone shared with you.
        </p>

        <form onSubmit={handleJoin} className="space-y-3">
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(null);
            }}
            placeholder="room code"
            className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm font-mono text-center focus:outline-none focus:border-accent2"
            autoFocus
          />

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-accent to-accent2 text-white px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Join room
          </button>
        </form>
      </div>
    </main>
  );
}
