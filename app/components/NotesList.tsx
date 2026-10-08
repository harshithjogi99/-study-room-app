'use client'
import AskNote from './AskNote'
import { useEffect, useState } from 'react'
import Quiz from './Quiz'
import Flashcards from './Flashcards'
import { supabase } from '../lib/supabase'

type Question = {
  question: string
  options: string[]
  correctIndex: number
}

type FlashcardType = {
  front: string
  back: string
}

type Note = {
  id: string
  url: string
  fileName: string
  summary: string | null
  quiz: Question[] | null
  flashcards: FlashcardType[] | null
  createdAt: string
}

const REQUEST_TIMEOUT_MS = 90000

// A new quiz gets a new key, so the Quiz component starts fresh
// (old answers and score cleared) instead of reusing its previous state.
function quizKey(noteId: string, quiz: Question[]) {
  const text = quiz.map((q) => q.question).join('|')
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0
  }
  return `${noteId}-${hash}`
}

export default function NotesList({ roomId }: { roomId: string }) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [quizLoadingId, setQuizLoadingId] = useState<string | null>(null)
  const [cardsLoadingId, setCardsLoadingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const fetchNotes = () => {
    fetch(`/api/notes/${roomId}`)
      .then((res) => res.json())
      .then((data) => {
        const unique = Array.from(new Map(data.map((n: Note) => [n.id, n])).values())
        setNotes(unique as Note[])
      })
      .catch((err) => console.error("Fetch error:", err))
  }

  useEffect(() => {
    fetchNotes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  // Keep the notes list live: new uploads from any participant show up automatically
  useEffect(() => {
    const channel = supabase
      .channel(`notes-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Note',
          filter: `roomId=eq.${roomId}`,
        },
        () => {
          fetchNotes()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  // One safe runner for all AI actions: always resets the spinner,
  // never replaces a note with an error object, and gives up after 90s.
  const runAiAction = async (
    endpoint: string,
    noteId: string,
    url: string,
    setLoading: (id: string | null) => void
  ) => {
    setLoading(noteId)
    setActionError(null)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId, url }),
        signal: controller.signal,
      })
      const data = await res.json().catch(() => null)

      if (!res.ok || !data || data.error) {
        setActionError(data?.error ?? 'Something went wrong. Please try again.')
        return
      }

      setNotes((prev) => prev.map((n) => (n.id === noteId ? data : n)))
    } catch (err: any) {
      setActionError(
        err?.name === 'AbortError'
          ? 'This took too long. Please try again.'
          : 'Network error. Please try again.'
      )
    } finally {
      clearTimeout(timer)
      setLoading(null)
    }
  }

  const handleSummarize = (noteId: string, url: string) =>
    runAiAction('/api/summarize', noteId, url, setLoadingId)

  const handleGenerateQuiz = (noteId: string, url: string) =>
    runAiAction('/api/quiz', noteId, url, setQuizLoadingId)

  // Same endpoint as Generate Quiz: the route overwrites the saved quiz and
  // uses your current due topics, so a new quiz can target what you should review now.
  const handleRegenerateQuiz = (noteId: string, url: string) => {
    const ok = window.confirm(
      'Replace the current quiz with a new one? Everyone in this room will see the new quiz.'
    )
    if (!ok) return
    runAiAction('/api/quiz', noteId, url, setQuizLoadingId)
  }

  const handleGenerateFlashcards = (noteId: string, url: string) =>
    runAiAction('/api/flashcards', noteId, url, setCardsLoadingId)

  if (notes.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-xl p-6 text-center">
        <p className="text-muted text-sm">No files uploaded yet.</p>
        <p className="text-muted text-xs mt-1 opacity-70">Upload a PDF above to get started with summaries and quizzes.</p>
      </div>
    )
  }

  return (
    <div>
      {actionError && (
        <p className="text-xs text-red-400 mb-3">{actionError}</p>
      )}

      <ul className="space-y-3">
        {notes.filter((note, i, arr) => arr.findIndex((n) => n.id === note.id) === i).map((note) => {
          const hasQuiz = !!note.quiz && note.quiz.length > 0

          return (
            <li key={note.id} className="border border-border rounded-xl p-4 shadow-sm bg-surface card-hover animate-fade-in">
              <a href={note.url} target="_blank" rel="noopener noreferrer" className="text-accent2 font-medium hover:underline">
                {note.fileName}
              </a>

              <div className="mt-2 flex gap-2 flex-wrap">
                {!note.summary && (
                  <button
                    onClick={() => handleSummarize(note.id, note.url)}
                    disabled={loadingId === note.id}
                    className="inline-flex items-center gap-1.5 text-xs bg-gradient-to-r from-accent to-accent2 text-white px-3 py-1.5 rounded-full disabled:opacity-70"
                  >
                    {loadingId === note.id && (
                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    )}
                    {loadingId === note.id ? 'Summarizing...' : 'Summarize'}
                  </button>
                )}

                {!hasQuiz && (
                  <button
                    onClick={() => handleGenerateQuiz(note.id, note.url)}
                    disabled={quizLoadingId === note.id}
                    className="inline-flex items-center gap-1.5 text-xs bg-border text-foreground px-3 py-1.5 rounded-full disabled:opacity-70"
                  >
                    {quizLoadingId === note.id && (
                      <span className="w-3 h-3 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                    )}
                    {quizLoadingId === note.id ? 'Generating Quiz...' : 'Generate Quiz'}
                  </button>
                )}

                {hasQuiz && (
                  <button
                    onClick={() => handleRegenerateQuiz(note.id, note.url)}
                    disabled={quizLoadingId === note.id}
                    className="inline-flex items-center gap-1.5 text-xs bg-border text-foreground px-3 py-1.5 rounded-full disabled:opacity-70"
                  >
                    {quizLoadingId === note.id && (
                      <span className="w-3 h-3 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                    )}
                    {quizLoadingId === note.id ? 'Regenerating Quiz...' : 'Regenerate quiz'}
                  </button>
                )}

                {!note.flashcards && (
                  <button
                    onClick={() => handleGenerateFlashcards(note.id, note.url)}
                    disabled={cardsLoadingId === note.id}
                    className="inline-flex items-center gap-1.5 text-xs bg-border text-foreground px-3 py-1.5 rounded-full disabled:opacity-70"
                  >
                    {cardsLoadingId === note.id && (
                      <span className="w-3 h-3 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                    )}
                    {cardsLoadingId === note.id ? 'Generating Flashcards...' : 'Generate Flashcards'}
                  </button>
                )}
              </div>

              {note.summary && (
                <p className="text-sm text-muted bg-background border border-border p-3 rounded-lg mt-3">{note.summary}</p>
              )}

              {hasQuiz && (
                <Quiz
                  key={quizKey(note.id, note.quiz as Question[])}
                  questions={note.quiz as Question[]}
                  noteId={note.id}
                  roomId={roomId}
                />
              )}
              {note.flashcards && note.flashcards.length > 0 && <Flashcards cards={note.flashcards} />}

              <AskNote url={note.url} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}