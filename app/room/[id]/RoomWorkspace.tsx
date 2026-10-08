"use client";

import { useState, ReactNode } from "react";

type Tab = "study" | "notes" | "tutor" | "whiteboard" | "voice" | "chat";

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  {
    id: "study",
    label: "Study",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  {
    id: "notes",
    label: "Notes",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path d="M7 3h8l4 4v14H7V3z M15 3v4h4M9 12h6M9 16h6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "tutor",
    label: "AI Tutor",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path d="M12 2a5 5 0 015 5c0 2-1 3-1 5v2H8v-2c0-2-1-3-1-5a5 5 0 015-5zM9 19h6M10 22h4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "whiteboard",
    label: "Whiteboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <rect x="3" y="4" width="18" height="13" rx="1.5" />
        <path d="M8 21h8M12 17v4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "voice",
    label: "Voice",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 11a7 7 0 0014 0M12 18v3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "chat",
    label: "Chat",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path d="M4 4h16v12H8l-4 4V4z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function RoomWorkspace({
  study,
  notes,
  tutor,
  whiteboard,
  voice,
  chat,
}: {
  study: ReactNode;
  notes: ReactNode;
  tutor: ReactNode;
  whiteboard: ReactNode;
  voice: ReactNode;
  chat: ReactNode;
}) {
  const [active, setActive] = useState<Tab>("study");

  const panels: Record<Tab, ReactNode> = {
    study,
    notes,
    tutor,
    whiteboard,
    voice,
    chat,
  };

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-8">
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={`flex items-center gap-2 text-sm font-medium px-5 py-3 rounded-xl whitespace-nowrap transition-all ${
                isActive
                  ? "bg-gradient-to-b from-accent to-accent2 text-white shadow-[0_4px_16px_rgba(139,92,246,0.35),inset_0_1px_0_rgba(255,255,255,0.25)] -translate-y-0.5"
                  : "bg-surface border border-border text-foreground/60 hover:text-foreground hover:border-foreground/20 shadow-sm"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="animate-fade-in">{panels[active]}</div>
    </div>
  );
}