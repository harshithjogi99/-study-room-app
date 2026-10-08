'use client'
import { useState } from 'react'

type Card = {
  front: string
  back: string
}

export default function Flashcards({ cards }: { cards: Card[] }) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  const card = cards[index]

  const next = () => {
    setFlipped(false)
    setIndex((i) => (i + 1) % cards.length)
  }

  const prev = () => {
    setFlipped(false)
    setIndex((i) => (i - 1 + cards.length) % cards.length)
  }

  return (
    <div className="mt-3">
      <div
        onClick={() => setFlipped((f) => !f)}
        className="cursor-pointer border border-border rounded-xl p-6 bg-background min-h-[120px] flex items-center justify-center text-center animate-fade-in"
      >
        <p className="text-sm text-foreground">
          {flipped ? card.back : card.front}
        </p>
      </div>

      <div className="flex items-center justify-between mt-2">
        <button
          onClick={prev}
          className="text-xs bg-border text-foreground px-3 py-1.5 rounded-full hover:opacity-80"
        >
          ← Prev
        </button>
        <span className="text-xs text-muted">
          {index + 1} / {cards.length} · tap card to flip
        </span>
        <button
          onClick={next}
          className="text-xs bg-border text-foreground px-3 py-1.5 rounded-full hover:opacity-80"
        >
          Next →
        </button>
      </div>
    </div>
  )
}