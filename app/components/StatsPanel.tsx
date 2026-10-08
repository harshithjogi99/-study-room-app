'use client'
import { useEffect, useState } from 'react'

type Stats = {
  totalQuizzes: number
  avgScore: number
  streak: number
}

export default function StatsPanel() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    fetch('/api/stats')
      .then((res) => (res.ok ? res.json() : null))
      .then(setStats)
      .catch(() => setStats(null))
  }, [])

  if (!stats || stats.totalQuizzes === 0) return null

  return (
    <div className="mt-10 grid grid-cols-3 gap-4 max-w-md mx-auto">
      <div className="border border-border rounded-xl p-4 bg-surface text-center card-hover">
        <p className="text-2xl font-bold gradient-text">{stats.totalQuizzes}</p>
        <p className="text-xs text-muted mt-1">Quizzes taken</p>
      </div>
      <div className="border border-border rounded-xl p-4 bg-surface text-center card-hover">
        <p className="text-2xl font-bold gradient-text">{stats.avgScore}%</p>
        <p className="text-xs text-muted mt-1">Avg. score</p>
      </div>
      <div className="border border-border rounded-xl p-4 bg-surface text-center card-hover">
        <p className="text-2xl font-bold gradient-text">{stats.streak}🔥</p>
        <p className="text-xs text-muted mt-1">Day streak</p>
      </div>
    </div>
  )
}