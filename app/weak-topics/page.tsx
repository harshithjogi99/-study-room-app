import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "../lib/prisma";
import { getOrCreateUser } from "../lib/getOrCreateUser";

export const dynamic = "force-dynamic";

// A topic is only flagged after this many answers, so one wrong answer isn't a verdict
const MIN_ANSWERS_TO_FLAG = 3;

type TopicStat = {
  topic: string;
  correct: number;
  total: number;
  notes: Set<string>;
};

export default async function WeakTopicsPage() {
  const user = await getOrCreateUser();
  if (!user) redirect("/");

  const results = await prisma.questionResult.findMany({
    where: { userId: user.id },
    select: { topic: true, noteId: true, isCorrect: true },
    take: 5000,
  });

  const map = new Map<string, TopicStat>();
  for (const r of results) {
    const key = r.topic ?? "Uncategorized";
    const stat = map.get(key) ?? { topic: key, correct: 0, total: 0, notes: new Set() };
    stat.total += 1;
    if (r.isCorrect) stat.correct += 1;
    stat.notes.add(r.noteId);
    map.set(key, stat);
  }

  // Weakest first; ties broken by whichever topic has more attempts
  const stats = Array.from(map.values())
    .map((s) => ({
      topic: s.topic,
      correct: s.correct,
      total: s.total,
      noteCount: s.notes.size,
      accuracy: Math.round((s.correct / s.total) * 100),
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total);

  const overall = results.length
    ? Math.round((results.filter((r) => r.isCorrect).length / results.length) * 100)
    : 0;

  return (
    <main className="flex flex-col items-center flex-1 px-6 md:px-16 py-14">
      <div className="w-full max-w-3xl">
        <Link href="/" className="text-sm text-muted hover:underline">
          ← Back
        </Link>
        <h1 className="text-3xl font-bold text-foreground mt-3 mb-1">My weak topics</h1>
        <p className="text-sm text-muted mb-8">
          Based on {results.length} answered {results.length === 1 ? "question" : "questions"} · overall accuracy {overall}%
        </p>

        {stats.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-8 text-center">
            <p className="text-muted text-sm">No quiz results yet.</p>
            <p className="text-muted text-xs mt-1 opacity-70">
              Finish a quiz in a room and your topics will show up here.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {stats.map((s) => {
              const weak = s.total >= MIN_ANSWERS_TO_FLAG && s.accuracy < 60;
              return (
                <li key={s.topic} className="border border-border rounded-xl p-4 bg-surface">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="font-medium text-foreground">
                      {s.topic}
                      {weak && s.topic !== "Uncategorized" && (
                        <span className="ml-2 text-xs text-accent2">needs practice</span>
                      )}
                    </span>
                    <span className="text-sm font-mono text-foreground">{s.accuracy}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent to-accent2"
                      style={{ width: `${s.accuracy}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted mt-2">
                    {s.correct} / {s.total} correct · across {s.noteCount} {s.noteCount === 1 ? "note" : "notes"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}