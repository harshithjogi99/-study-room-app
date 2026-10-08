'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

type Stroke = {
  x0: number
  y0: number
  x1: number
  y1: number
  color: string
}

const COLORS = ['#f4f4f5', '#8b5cf6', '#22d3ee', '#f87171', '#4ade80', '#fbbf24']

export default function Whiteboard({ roomId }: { roomId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)
  const [color, setColor] = useState(COLORS[0])
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const getContext = () => canvasRef.current?.getContext('2d') ?? null

  const drawLine = (stroke: Stroke) => {
    const ctx = getContext()
    if (!ctx) return
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(stroke.x0, stroke.y0)
    ctx.lineTo(stroke.x1, stroke.y1)
    ctx.stroke()
  }

  useEffect(() => {
    const channel = supabase
      .channel(`board-${roomId}`)
      .on('broadcast', { event: 'stroke' }, (payload) => {
        drawLine(payload.payload as Stroke)
      })
      .on('broadcast', { event: 'clear' }, () => {
        const ctx = getContext()
        const canvas = canvasRef.current
        if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height)
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId])

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      const touch = e.touches[0]
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    drawing.current = true
    lastPoint.current = getPos(e)
  }

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current || !lastPoint.current) return
    const pos = getPos(e)
    const stroke: Stroke = { x0: lastPoint.current.x, y0: lastPoint.current.y, x1: pos.x, y1: pos.y, color }
    drawLine(stroke)
    channelRef.current?.send({ type: 'broadcast', event: 'stroke', payload: stroke })
    lastPoint.current = pos
  }

  const handleEnd = () => {
    drawing.current = false
    lastPoint.current = null
  }

  const handleClear = () => {
    const ctx = getContext()
    const canvas = canvasRef.current
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height)
    channelRef.current?.send({ type: 'broadcast', event: 'clear', payload: {} })
  }

  return (
    <div className="border border-border rounded-xl p-4 bg-surface shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full border-2 ${color === c ? 'border-accent2' : 'border-border'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <button
          onClick={handleClear}
          className="text-xs bg-border text-foreground px-3 py-1.5 rounded-full hover:opacity-80"
        >
          Clear board
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={400}
        height={300}
        className="w-full bg-background rounded-lg border border-border touch-none cursor-crosshair"
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      />
    </div>
  )
}