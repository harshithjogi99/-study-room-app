'use client'
import { useState } from 'react'

type QA = {
  question: string
  answer: string
}

export default function AskNote({ url }: { url: string }) {
  const [question, setQuestion] = useState('')
  const [history, setHistory] = useState<QA[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const handleAsk = async () => {
    if (!question.trim()) return
    const currentQuestion = question
    setQuestion('')
    setLoading(true)

    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, question: currentQuestion }),
    })
    const data = await res.json()

    setHistory((prev) => [...prev, { question: currentQuestion, answer: data.answer }])
    setLoading(false)
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs bg-teal-500 text-white px-3 py-1.5 rounded-full hover:bg-teal-600"
      >
        {open ? 'Hide Q&A' : 'Ask a question'}
      </button>

      {open && (
        <div className="mt-2 border border-border rounded-lg p-3 bg-surface">
          {history.map((qa, i) => (
            <div key={i} className="mb-2 text-sm">
              <p className="font-medium text-foreground">Q: {qa.question}</p>
              <p className="text-muted mt-0.5">A: {qa.answer}</p>
            </div>
          ))}

          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
              placeholder="Ask about this document..."
              disabled={loading}
              className="flex-1 border border-border bg-background text-foreground placeholder:text-muted rounded-full px-3 py-1.5 text-sm"
            />
            <button
              onClick={handleAsk}
              disabled={loading || !question.trim()}
              className="bg-teal-500 text-white px-4 py-1.5 rounded-full text-sm disabled:opacity-40"
            >
              {loading ? '...' : 'Ask'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}