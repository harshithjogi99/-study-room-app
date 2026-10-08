'use client'
import { useEffect, useState } from 'react'
import { renameRoom, deleteRoom, leaveRoom, toggleRoomLock, removeParticipant } from '../actions'
import { supabase } from '../lib/supabase'

type ParticipantEntry = {
  userId: string
  user: { name: string | null }
}

export default function RoomSettings({
  roomId,
  roomName,
  isCreator,
  locked,
  participants: initialParticipants,
  creatorId,
}: {
  roomId: string
  roomName: string
  isCreator: boolean
  locked: boolean
  participants: ParticipantEntry[]
  creatorId: string
}) {
  const [open, setOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [managingParticipants, setManagingParticipants] = useState(false)
  const [newName, setNewName] = useState(roomName)
  const [isLocked, setIsLocked] = useState(locked)
  const [muteSent, setMuteSent] = useState(false)
  const [participants, setParticipants] = useState(initialParticipants)

  // Keep the participant list live, same approach as ParticipantList.tsx
  useEffect(() => {
    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Participant',
          filter: `roomId=eq.${roomId}`,
        },
        async () => {
          const res = await fetch(`/api/rooms/${roomId}/participants`)
          const data = await res.json()
          setParticipants(data)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId])

  const handleRename = async () => {
    if (!newName.trim()) return
    await renameRoom(roomId, newName)
    setRenaming(false)
    setOpen(false)
    window.location.reload()
  }

  const handleDelete = async () => {
    if (confirm('Delete this room permanently? This cannot be undone.')) {
      await deleteRoom(roomId)
    }
  }

  const handleLeave = async () => {
    if (confirm('Leave this room?')) {
      await leaveRoom(roomId)
    }
  }

  const handleToggleLock = async () => {
    const nowLocked = await toggleRoomLock(roomId)
    setIsLocked(nowLocked)
  }

  const handleRemove = async (targetUserId: string) => {
    if (!confirm('Remove this person from the room?')) return

    await removeParticipant(roomId, targetUserId)

    const channel = supabase.channel(`voice-${roomId}`)
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'kicked',
          payload: { userId: targetUserId },
        })
        setTimeout(() => supabase.removeChannel(channel), 500)
      }
    })
    // No reload needed — the postgres_changes subscription above updates
    // the list automatically once the row is deleted.
  }

  const handleMuteAll = async () => {
    const channel = supabase.channel(`voice-${roomId}`)
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'mute-all',
          payload: {},
        })
        setMuteSent(true)
        setTimeout(() => setMuteSent(false), 2000)
        setTimeout(() => supabase.removeChannel(channel), 500)
      }
    })
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-muted hover:text-foreground text-sm px-2 py-1 rounded-full hover:bg-border transition-colors"
      >
        ⋯
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-surface border border-border rounded-lg shadow-lg z-10 overflow-hidden">
          {isCreator && (
            <>
              <button
                onClick={() => setRenaming(true)}
                className="block w-full text-left px-4 py-2 text-sm text-foreground hover:bg-border"
              >
                Rename room
              </button>
              <button
                onClick={handleToggleLock}
                className="block w-full text-left px-4 py-2 text-sm text-foreground hover:bg-border"
              >
                {isLocked ? '🔓 Unlock room' : '🔒 Lock room'}
              </button>
              <button
                onClick={handleMuteAll}
                className="block w-full text-left px-4 py-2 text-sm text-foreground hover:bg-border"
              >
                {muteSent ? 'Muted everyone' : '🔇 Mute everyone'}
              </button>
              <button
                onClick={() => setManagingParticipants(true)}
                className="block w-full text-left px-4 py-2 text-sm text-foreground hover:bg-border"
              >
                Manage participants
              </button>
              <button
                onClick={handleDelete}
                className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-border"
              >
                Delete room
              </button>
            </>
          )}
          {!isCreator && (
            <button
              onClick={handleLeave}
              className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-border"
            >
              Leave room
            </button>
          )}
        </div>
      )}

      {renaming && (
        <div className="absolute right-0 mt-2 w-64 bg-surface border border-border rounded-lg shadow-lg z-20 p-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full border border-border bg-background text-foreground rounded px-2 py-1.5 text-sm mb-2"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setRenaming(false)}
              className="text-xs text-muted px-3 py-1.5 rounded hover:bg-border"
            >
              Cancel
            </button>
            <button
              onClick={handleRename}
              className="text-xs bg-gradient-to-r from-accent to-accent2 text-white px-3 py-1.5 rounded"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {managingParticipants && (
        <div className="absolute right-0 mt-2 w-72 bg-surface border border-border rounded-lg shadow-lg z-20 p-3">
          <p className="text-xs text-muted mb-2">Remove someone from the room:</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {participants.filter((p) => p.userId !== creatorId).length === 0 && (
              <p className="text-xs text-muted italic px-2 py-1.5">No one else is here yet.</p>
            )}
            {participants
              .filter((p) => p.userId !== creatorId)
              .map((p) => (
                <div
                  key={p.userId}
                  className="flex items-center justify-between text-sm px-2 py-1.5 rounded hover:bg-border"
                >
                  <span className="text-foreground">{p.user.name ?? 'Someone'}</span>
                  <button
                    onClick={() => handleRemove(p.userId)}
                    className="text-xs text-red-400 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
          </div>
          <button
            onClick={() => setManagingParticipants(false)}
            className="text-xs text-muted mt-2 px-3 py-1.5 rounded hover:bg-border w-full text-center"
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}