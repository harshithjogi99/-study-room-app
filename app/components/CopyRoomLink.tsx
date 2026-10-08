"use client";

import { useState } from "react";

export default function CopyRoomLink({
  roomId,
  roomCode,
}: {
  roomId: string;
  roomCode?: string | null;
}) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyLink = async () => {
    const url = roomCode
      ? `${window.location.origin}/r/${roomCode}`
      : `${window.location.origin}/room/${roomId}`;
    await navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = async () => {
    if (!roomCode) return;
    await navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={handleCopyLink}
        className="text-xs font-mono bg-surface border border-border rounded-lg px-3 py-1.5 hover:border-accent2 transition-colors"
      >
        {copiedLink ? "Copied!" : "Copy invite link"}
      </button>

      {roomCode && (
        <button
          onClick={handleCopyCode}
          className="text-xs font-mono bg-surface border border-border rounded-lg px-3 py-1.5 hover:border-accent2 transition-colors"
        >
          {copiedCode ? "Copied!" : `Code: ${roomCode}`}
        </button>
      )}
    </div>
  );
}