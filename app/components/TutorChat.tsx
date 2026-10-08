'use client'
import { useEffect, useRef, useState } from 'react'

type TutorMessage = {
  id: string
  role: string
  content: string
  createdAt: string
}

export default function TutorChat({ roomId }: { roomId: string }) {
  const [messages, setMessages] = useState<TutorMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/tutor?roomId=${roomId}`)
      .then((res) => res.json())
      .then(setMessages)
      .catch((err) => console.error('Fetch tutor messages error:', err))
  }, [roomId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const question = input
    setInput('')
    setLoading(true)

    // Optimistically show the user's message
    setMessages((prev) => [
      ...prev,
      { id: `temp-${Date.now()}`, role: 'user', content: question, createdAt: new Date().toISOString() },
    ])

    const res = await fetch('/api/tutor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, question }),
    })
    const aiMessage = await res.json()

    setMessages((prev) => [...prev, aiMessage])
    setLoading(false)
  }

  return (
    <div className="border border-border rounded-xl p-4 bg-surface shadow-sm">
      <p className="text-xs text-muted font-mono mb-2">ask about all your uploaded notes</p>
      <div className="h-72 overflow-y-auto space-y-3 mb-3 pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-muted text-center mt-8">
            Ask me anything about the notes uploaded in this room.
          </p>
        )}
        {messages.map((msg) => {
          const isUser = msg.role === 'user'
          return (
            <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
              <span
                className={`inline-block px-3 py-2 text-sm max-w-[85%] rounded-2xl ${
                  isUser
                    ? 'bg-gradient-to-r from-accent to-accent2 text-white rounded-br-sm'
                    : 'bg-border text-foreground rounded-bl-sm'
                }`}
              >
                {msg.content}
              </span>
            </div>
          )
        })}
        {loading && (
          <div className="flex justify-start animate-fade-in">
            <span className="inline-block px-3 py-2 text-sm bg-border text-muted rounded-2xl rounded-bl-sm">
              Thinking...
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Ask your AI tutor..."
          disabled={loading}
          className="flex-1 border border-border bg-background text-foreground rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="bg-gradient-to-r from-accent to-accent2 text-white px-5 py-2 rounded-full text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          Ask
        </button>
      </div>
    </div>
  )
}