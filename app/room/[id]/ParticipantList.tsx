"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../supabase";

type Participant = {
  id: string;
  user: {
    name: string | null;
    email: string;
  };
};

export default function ParticipantList({
  roomId,
  initialParticipants,
}: {
  roomId: string;
  initialParticipants: Participant[];
}) {
  const [participants, setParticipants] = useState(initialParticipants);

  useEffect(() => {
    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "Participant",
          filter: `roomId=eq.${roomId}`,
        },
        async () => {
          const res = await fetch(`/api/rooms/${roomId}/participants`);
          const data = await res.json();
          setParticipants(data);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  return (
    <ul className="space-y-1">
      {participants.length === 0 && (
        <li className="text-gray-400">No one has joined yet.</li>
      )}
      {participants.map((p) => (
        <li key={p.id}>{p.user.name ?? p.user.email}</li>
      ))}
    </ul>
  );
}