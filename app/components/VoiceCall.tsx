'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

type PeerInfo = {
  pc: RTCPeerConnection
  audioEl: HTMLAudioElement
  polite: boolean
  makingOffer: boolean
}

export default function VoiceCall({ roomId }: { roomId: string }) {
  const sessionId = useRef(crypto.randomUUID()).current
  const [joined, setJoined] = useState(false)
  const [muted, setMuted] = useState(false)
  const [sharingScreen, setSharingScreen] = useState(false)
  const [remoteScreenActive, setRemoteScreenActive] = useState(false)
  const [remoteUsers, setRemoteUsers] = useState<string[]>([])

  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const peersRef = useRef<Record<string, PeerInfo>>({})
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const screenVideoRef = useRef<HTMLVideoElement>(null)
  const remoteScreenRef = useRef<HTMLVideoElement>(null)

  const createPeerConnection = (peerId: string) => {
    const polite = sessionId > peerId

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!)
    })

    const audioEl = new Audio()
    audioEl.autoplay = true

    const peerInfo: PeerInfo = { pc, audioEl, polite, makingOffer: false }
    peersRef.current[peerId] = peerInfo

    pc.ontrack = (event) => {
      console.log('ontrack fired:', event.track.kind, 'from peer:', peerId)
      if (event.track.kind === 'audio') {
        audioEl.srcObject = event.streams[0]
      } else if (event.track.kind === 'video') {
        console.log('Video track received, remoteScreenRef exists:', !!remoteScreenRef.current)
        if (remoteScreenRef.current) {
          remoteScreenRef.current.srcObject = event.streams[0]
          setRemoteScreenActive(true)
        }
        event.track.onended = () => setRemoteScreenActive(false)
      }
    }
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channelRef.current?.send({
          type: 'broadcast',
          event: 'signal',
          payload: { to: peerId, from: sessionId, kind: 'ice', data: event.candidate },
        })
      }
    }

    pc.onnegotiationneeded = async () => {
      try {
        peerInfo.makingOffer = true
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        channelRef.current?.send({
          type: 'broadcast',
          event: 'signal',
          payload: { to: peerId, from: sessionId, kind: 'offer', data: pc.localDescription },
        })
      } catch (err) {
        console.error('Negotiation error:', err)
      } finally {
        peerInfo.makingOffer = false
      }
    }

    return pc
  }

  const joinCall = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    localStreamRef.current = stream
    setJoined(true)

    const channel = supabase
      .channel(`voice-${roomId}`)
      .on('broadcast', { event: 'signal' }, async (payload) => {
        const { to, from, kind, data } = payload.payload as {
          to: string
          from: string
          kind: string
          data: unknown
        }
        if (to !== sessionId || from === sessionId) return

        let peer = peersRef.current[from]
        if (!peer) {
          createPeerConnection(from)
          peer = peersRef.current[from]
          setRemoteUsers((prev) => (prev.includes(from) ? prev : [...prev, from]))
        }

        try {
          if (kind === 'offer') {
            const offerCollision =
              peer.makingOffer || peer.pc.signalingState !== 'stable'
            const ignoreOffer = !peer.polite && offerCollision

            if (ignoreOffer) return

            if (offerCollision) {
              await Promise.all([
                peer.pc.setLocalDescription({ type: 'rollback' }),
                peer.pc.setRemoteDescription(data as RTCSessionDescriptionInit),
              ])
            } else {
              await peer.pc.setRemoteDescription(data as RTCSessionDescriptionInit)
            }

            const answer = await peer.pc.createAnswer()
            await peer.pc.setLocalDescription(answer)
            channelRef.current?.send({
              type: 'broadcast',
              event: 'signal',
              payload: { to: from, from: sessionId, kind: 'answer', data: peer.pc.localDescription },
            })
          } else if (kind === 'answer') {
            await peer.pc.setRemoteDescription(data as RTCSessionDescriptionInit)
          } else if (kind === 'ice') {
            try {
              await peer.pc.addIceCandidate(data as RTCIceCandidateInit)
            } catch (err) {
              console.error('ICE candidate error:', err)
            }
          }
        } catch (err) {
          console.error('Signal handling error:', err)
        }
      })
      .on('broadcast', { event: 'user-joined' }, (payload) => {
        const { userId: newUser } = payload.payload as { userId: string }
        if (newUser === sessionId) return
        setRemoteUsers((prev) => (prev.includes(newUser) ? prev : [...prev, newUser]))
        createPeerConnection(newUser)
      })
      .on('broadcast', { event: 'mute-all' }, () => {
        const track = localStreamRef.current?.getAudioTracks()[0]
        if (track) {
          track.enabled = false
          setMuted(true)
        }
      })
      .on('broadcast', { event: 'kicked' }, (payload) => {
        const { userId } = payload.payload as { userId: string }
        if (userId === sessionId) {
          leaveCall()
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.send({
            type: 'broadcast',
            event: 'user-joined',
            payload: { userId: sessionId },
          })
        }
      })

    channelRef.current = channel
  }

  const leaveCall = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    screenStreamRef.current?.getTracks().forEach((t) => t.stop())
    Object.values(peersRef.current).forEach(({ pc }) => pc.close())
    peersRef.current = {}
    channelRef.current && supabase.removeChannel(channelRef.current)
    setJoined(false)
    setSharingScreen(false)
    setRemoteScreenActive(false)
    setRemoteUsers([])
  }

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0]
    if (track) {
      track.enabled = !track.enabled
      setMuted(!track.enabled)
    }
  }

  const toggleScreenShare = async () => {
    if (sharingScreen) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop())
      setSharingScreen(false)
      return
    }
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
    screenStreamRef.current = stream

    Object.values(peersRef.current).forEach(({ pc }) => {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))
    })
    setSharingScreen(true)

    stream.getVideoTracks()[0].onended = () => setSharingScreen(false)
  }

  useEffect(() => {
    return () => {
      leaveCall()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (sharingScreen && screenVideoRef.current && screenStreamRef.current) {
      screenVideoRef.current.srcObject = screenStreamRef.current
    }
  }, [sharingScreen])

  return (
    <div className="border border-border rounded-xl p-4 bg-surface shadow-sm">
      {!joined ? (
        <button
          onClick={joinCall}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-accent to-accent2 text-white px-4 py-2 rounded-full text-sm hover:opacity-90"
        >
          🎙️ Join voice call
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 bg-background border border-border rounded-full px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-foreground">You</span>
              <span className="text-xs">{muted ? '🔇' : '🎙️'}</span>
            </div>
            {remoteUsers.map((uid, i) => (
              <div key={uid} className="flex items-center gap-1.5 bg-background border border-border rounded-full px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-foreground">Participant {i + 1}</span>
                <span className="text-xs">🎙️</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={toggleMute}
              className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full ${muted ? 'bg-red-600 text-white' : 'bg-border text-foreground'}`}
            >
              {muted ? '🔇 Unmute' : '🎙️ Mute'}
            </button>
            <button
              onClick={toggleScreenShare}
              className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full ${sharingScreen ? 'bg-accent2 text-black' : 'bg-border text-foreground'}`}
            >
              {sharingScreen ? '🛑 Stop sharing' : '🖥️ Share screen'}
            </button>
            <button
              onClick={leaveCall}
              className="inline-flex items-center gap-1.5 text-xs bg-red-600 text-white px-3 py-1.5 rounded-full"
            >
              📞 Leave call
            </button>
          </div>

          {sharingScreen && (
            <div>
              <p className="text-xs text-accent2 font-mono mb-1">your screen</p>
              <video
                ref={screenVideoRef}
                autoPlay
                muted
                className="w-full rounded-lg border-2 border-accent2"
              />
            </div>
          )}

          <div className={remoteScreenActive ? '' : 'hidden'}>
            <p className="text-xs text-accent2 font-mono mb-1">shared screen</p>
            <video
              ref={remoteScreenRef}
              autoPlay
              playsInline
              className="w-full rounded-lg border-2 border-accent2"
            />
          </div>
        </div>
      )}
    </div>
  )
}