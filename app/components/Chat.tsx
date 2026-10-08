'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

type Message = {
  id: string
  roomId: string
  userId: string
  userName: string
  content: string
  createdAt: string
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getInitial(name: string) {
  return name.charAt(0).toUpperCase()
}

export default function Chat({ roomId, currentUserId }: { roomId: string; currentUserId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/messages/${roomId}`)
      .then((res) => res.json())
      .then(setMessages)
      .catch((err) => console.error('Fetch messages error:', err))

    const channel = supabase
      .channel(`chat-${roomId}`)
      .on('broadcast', { event: 'new-message' }, (payload) => {
        const newMsg = payload.payload as Message
        setMessages((prev) => (prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim()) return

    const res = await fetch(`/api/messages/${roomId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: input }),
    })
    const message = await res.json()

    const channel = supabase.channel(`chat-${roomId}`)
    await channel.send({
      type: 'broadcast',
      event: 'new-message',
      payload: message,
    })

    setMessages((prev) => [...prev, message])
    setInput('')
  }

  return (
    <div className="border border-border rounded-xl p-4 bg-surface shadow-sm">
      <div className="h-72 overflow-y-auto space-y-3 mb-3 pr-1">
        {messages.map((msg) => {
          const isMine = msg.userId === currentUserId
          return (
             <div key={msg.id} className={`flex items-end gap-2 animate-fade-in ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className="w-7 h-7 rounded-full bg-border text-accent2 text-xs font-semibold flex items-center justify-center shrink-0">
                {getInitial(msg.userName)}
              </div>
              <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[75%]`}>
                <span className="text-[11px] text-muted mb-0.5">
                  {msg.userName} · {formatTime(msg.createdAt)}
                </span>
                <span
                  className={`inline-block px-3 py-2 text-sm ${
                    isMine
                      ? 'bg-gradient-to-r from-accent to-accent2 text-white rounded-2xl rounded-br-sm'
                      : 'bg-border text-foreground rounded-2xl rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                </span>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
          className="flex-1 border border-border bg-background text-foreground rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim()}
          className="bg-gradient-to-r from-accent to-accent2 text-white px-5 py-2 rounded-full text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          Send
        </button>
      </div>
    </div>
  )
}