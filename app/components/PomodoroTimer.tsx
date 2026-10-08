'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

type TimerState = {
  running: boolean
  endTime: number | null // timestamp when timer will hit 0
  duration: number // total seconds for this session
}

const DEFAULT_DURATION = 25 * 60 // 25 minutes

export default function PomodoroTimer({ roomId }: { roomId: string }) {
  const [state, setState] = useState<TimerState>({
    running: false,
    endTime: null,
    duration: DEFAULT_DURATION,
  })
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_DURATION)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    const channel = supabase
      .channel(`timer-${roomId}`)
      .on('broadcast', { event: 'timer-update' }, (payload) => {
        setState(payload.payload as TimerState)
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId])

  useEffect(() => {
    if (!state.running || !state.endTime) {
      setSecondsLeft(state.duration)
      return
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.round((state.endTime! - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining === 0) clearInterval(interval)
    }, 1000)

    return () => clearInterval(interval)
  }, [state])

  const broadcast = async (newState: TimerState) => {
    setState(newState)
    await channelRef.current?.send({
      type: 'broadcast',
      event: 'timer-update',
      payload: newState,
    })
  }

  const handleStart = () => {
    const endTime = Date.now() + secondsLeft * 1000
    broadcast({ running: true, endTime, duration: state.duration })
  }

  const handlePause = () => {
    broadcast({ running: false, endTime: null, duration: secondsLeft })
  }

  const handleReset = () => {
    broadcast({ running: false, endTime: null, duration: DEFAULT_DURATION })
  }

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60

    return (
    <div className="border border-border rounded-xl p-4 bg-surface shadow-sm text-center">
      <p className="text-xs text-muted mb-1 font-mono">study timer</p>
      <p className="text-4xl font-bold gradient-text mb-3">
        {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
      </p>
      <div className="flex justify-center gap-2">
        {!state.running ? (
          <button
            onClick={handleStart}
            className="bg-gradient-to-r from-accent to-accent2 text-white px-4 py-1.5 rounded-full text-sm hover:opacity-90 transition-opacity"
          >
            Start
          </button>
        ) : (
          <button
            onClick={handlePause}
            className="bg-yellow-500 text-white px-4 py-1.5 rounded-full text-sm hover:bg-yellow-600"
          >
            Pause
          </button>
        )}
        <button
          onClick={handleReset}
          className="bg-border text-foreground px-4 py-1.5 rounded-full text-sm hover:opacity-80"
        >
          Reset
        </button>
      </div>
    </div>
  )
}