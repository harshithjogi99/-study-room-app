"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { createRoom } from "./actions";
import StatsPanel from "./components/StatsPanel";

const ROUTES = {
  joinRoom: "/room/join",
  myNotes: "/notes",
  quizzes: "/quizzes",
};

export default function Home() {
  const { isSignedIn } = useUser();

  return (
    <main className="min-h-screen flex items-center px-10 md:px-20 lg:px-28 py-20">
      <div className="w-full max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-20 items-center">
        {/* Left: content */}
        <div className="text-center lg:text-left">
          <p className="text-base text-accent2 font-mono mb-6">study together, powered by AI</p>

          <h1 className="text-6xl sm:text-7xl lg:text-8xl font-bold tracking-tight mb-8 leading-[1.05]">
  Turn your notes into{" "}
  <span className="gradient-text">a study session</span>
</h1>

          <p className="text-muted text-xl leading-relaxed mb-12 max-w-2xl mx-auto lg:mx-0">
            Upload a PDF, get an instant summary and quiz, then study live with
            others in a synced room.
          </p>

          {!isSignedIn && (
            <p className="text-muted text-base">Sign in above to create or join a room.</p>
          )}

          {isSignedIn && (
            <form action={createRoom}>
              <button
                type="submit"
                className="bg-gradient-to-r from-accent to-accent2 text-white px-10 py-5 rounded-xl font-medium text-lg hover:opacity-90 hover:scale-105 transition-all shadow-lg shadow-accent/20 animate-pulse-glow"
              >
                Create a room
              </button>
            </form>
          )}

          {isSignedIn && (
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto lg:mx-0 text-left">
              <Link
                href={ROUTES.joinRoom}
                className="rounded-xl border border-border bg-surface p-6 hover:border-foreground/20 transition-colors"
              >
                <svg
                  className="w-7 h-7 text-accent2 mb-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    d="M10 4H6a2 2 0 00-2 2v12a2 2 0 002 2h4M16 16l4-4-4-4M20 12H9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="text-base font-medium">Join a room</p>
                <p className="text-sm text-muted mt-1 font-mono">enter a room code</p>
              </Link>

              <Link
                href={ROUTES.myNotes}
                className="rounded-xl border border-border bg-surface p-6 hover:border-foreground/20 transition-colors"
              >
                <svg
                  className="w-7 h-7 text-accent2 mb-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    d="M7 3h8l4 4v14H7V3z M15 3v4h4M9 12h6M9 16h6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="text-base font-medium">My notes</p>
                <p className="text-sm text-muted mt-1">everything you've uploaded</p>
              </Link>

              <Link
                href={ROUTES.quizzes}
                className="rounded-xl border border-border bg-surface p-6 hover:border-foreground/20 transition-colors"
              >
                <svg
                  className="w-7 h-7 text-accent2 mb-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    d="M9 12l2 2 4-4M12 21a9 9 0 100-18 9 9 0 000 18z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="text-base font-medium">Quizzes</p>
                <p className="text-sm text-muted mt-1">test what you've learned</p>
              </Link>
            </div>
          )}

          {isSignedIn && (
            <div className="mt-10 max-w-2xl mx-auto lg:mx-0 text-lg">
              <StatsPanel />
            </div>
          )}
        </div>

        {/* Right: decorative graphic + code panel */}
        <div className="relative hidden lg:flex flex-col items-center justify-center min-h-[640px]">
          <div className="absolute -top-20 -right-16 w-[28rem] h-[28rem] rounded-full bg-accent/25 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-16 w-[24rem] h-[24rem] rounded-full bg-accent2/25 blur-3xl pointer-events-none" />

          <div className="relative w-full max-w-xl aspect-square rounded-full border border-border/60 flex items-center justify-center">
            <div className="w-3/4 aspect-square rounded-full border border-border/40 flex items-center justify-center">
              <div className="w-1/2 aspect-square rounded-full bg-gradient-to-br from-accent to-accent2 opacity-25 blur-2xl" />
            </div>
          </div>

          <div className="relative -mt-32 w-full max-w-md bg-surface border border-border rounded-xl overflow-hidden text-left shadow-2xl">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <span className="w-3.5 h-3.5 rounded-full bg-red-500/70" />
              <span className="w-3.5 h-3.5 rounded-full bg-yellow-500/70" />
              <span className="w-3.5 h-3.5 rounded-full bg-green-500/70" />
              <span className="ml-2 text-sm text-muted font-mono">room.json</span>
            </div>
            <div className="p-6 font-mono text-base leading-relaxed">
              <p><span className="text-accent2">const</span> <span className="text-foreground">room</span> = {"{"}</p>
              <p className="pl-4"><span className="text-purple-300">notes</span>: <span className="text-green-400">"summarized"</span>,</p>
              <p className="pl-4"><span className="text-purple-300">quiz</span>: <span className="text-green-400">"generated"</span>,</p>
              <p className="pl-4"><span className="text-purple-300">timer</span>: <span className="text-green-400">"synced"</span>,</p>
              <p className="pl-4"><span className="text-purple-300">chat</span>: <span className="text-green-400">"live"</span></p>
              <p>{"}"}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}