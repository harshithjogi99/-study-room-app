"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function KickListener({
  roomId,
  currentUserId,
}: {
  roomId: string;
  currentUserId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`voice-${roomId}`)
      .on("broadcast", { event: "kicked" }, (payload) => {
        const { userId } = payload.payload as { userId: string };
        if (userId === currentUserId) {
          alert("You've been removed from this room.");
          router.push("/");
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, currentUserId, router]);

  return null;
}