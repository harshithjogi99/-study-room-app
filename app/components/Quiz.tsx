'use client'
import { useEffect, useState } from 'react'

type Question = {
  question: string
  options: string[]
  correctIndex: number
  topic?: string // filled in by Gemini at generation time (next step)
}

export default function Quiz({
  questions,
  noteId,
  roomId,
}: {
  questions: Question[]
  noteId: string
  roomId: string
}) {
  const [selected, setSelected] = useState<Record<number, number>>({})
  const [saved, setSaved] = useState(false)

  const handleSelect = (qIndex: number, optIndex: number) => {
    if (selected[qIndex] !== undefined) return // already answered
    setSelected((prev) => ({ ...prev, [qIndex]: optIndex }))
  }

  const allAnswered = Object.keys(selected).length === questions.length

  useEffect(() => {
    if (!allAnswered || saved) return

    const results = questions.map((q, i) => ({
      question: q.question,
      topic: q.topic ?? null,
      selectedIndex: selected[i],
      correctIndex: q.correctIndex,
      isCorrect: selected[i] === q.correctIndex,
    }))
    const score = results.filter((r) => r.isCorrect).length

    fetch('/api/attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noteId, roomId, score, total: questions.length, results }),
    }).catch((err) => console.error('Save attempt error:', err))

    setSaved(true)
  }, [allAnswered, saved, questions, selected, noteId, roomId])

  return (
    <div className="space-y-4 mt-2">
      {questions.map((q, qIndex) => (
        <div key={qIndex} className="border border-border rounded p-3 bg-background animate-fade-in">
          <p className="font-medium text-sm mb-2 text-foreground">{qIndex + 1}. {q.question}</p>
          <div className="space-y-1">
            {q.options.map((opt, optIndex) => {
              const isSelected = selected[qIndex] === optIndex
              const isCorrect = optIndex === q.correctIndex
              const showResult = selected[qIndex] !== undefined

              // Translucent tints + the normal text color stay readable in both light and dark mode
              let bgColor = 'bg-surface text-foreground border-border hover:opacity-80'
              if (showResult && isSelected && isCorrect) bgColor = 'bg-green-500/25 text-foreground border-green-500'
              if (showResult && isSelected && !isCorrect) bgColor = 'bg-red-500/25 text-foreground border-red-500'
              if (showResult && !isSelected && isCorrect) bgColor = 'bg-green-500/10 text-foreground border-green-500/60'
              return (
                <button
                  key={optIndex}
                  onClick={() => handleSelect(qIndex, optIndex)}
                  className={`block w-full text-left text-sm border rounded px-2 py-1 ${bgColor}`}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {allAnswered && (
        <p className="text-sm text-accent2 font-medium animate-fade-in">
          Quiz complete — {questions.reduce((acc, q, i) => (selected[i] === q.correctIndex ? acc + 1 : acc), 0)} / {questions.length} correct
        </p>
      )}
    </div>
  )
}