import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../lib/prisma'
import { GoogleGenAI } from '@google/genai'

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

// Tried in order. If the first is overloaded, the second is used.
const MODELS = ['gemini-3.6-flash', 'gemini-2.5-flash']

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function isBusyError(err: any): boolean {
  const msg = String(err?.message ?? err)
  return (
    err?.status === 503 ||
    err?.status === 429 ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('overloaded') ||
    msg.includes('high demand')
  )
}

// Try each model, retrying when Gemini says it is busy.
async function generateWithRetry(parts: any[]) {
  let lastError: unknown
  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await genAI.models.generateContent({
          model,
          config: { responseMimeType: 'application/json' },
          contents: [{ role: 'user', parts }],
        })
      } catch (err) {
        lastError = err
        console.error(`Gemini ${model} attempt ${attempt} failed:`, (err as any)?.status ?? err)
        if (!isBusyError(err)) throw err // a real error, retrying won't help
        await sleep(1500 * attempt)
      }
    }
  }
  throw lastError
}

// Keep only well-formed flashcards so bad AI output never reaches the database.
function cleanCards(raw: unknown): { front: string; back: string }[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (c: any) =>
        c &&
        typeof c.front === 'string' &&
        c.front.trim() &&
        typeof c.back === 'string' &&
        c.back.trim()
    )
    .map((c: any) => ({ front: c.front.trim(), back: c.back.trim() }))
}

export async function POST(req: NextRequest) {
  try {
    const { noteId, url } = await req.json()

    const fileRes = await fetch(url)
    const arrayBuffer = await fileRes.arrayBuffer()
    const base64Data = Buffer.from(arrayBuffer).toString('base64')

    const parts = [
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: base64Data,
        },
      },
      {
        text: `Based on this document, create 8 flashcards for studying. Return ONLY valid JSON, no markdown formatting, no code fences, in this exact structure:
[
  { "front": "term or question", "back": "definition or answer" }
]`,
      },
    ]

    const response = await generateWithRetry(parts)

    let cardsText = response.text ?? '[]'
    cardsText = cardsText.replace(/```json|```/g, '').trim()

    const flashcards = cleanCards(JSON.parse(cardsText))
    if (flashcards.length === 0) {
      return NextResponse.json(
        { error: 'Flashcard generation returned no valid cards' },
        { status: 502 }
      )
    }

    const updated = await prisma.note.update({
      where: { id: noteId },
      data: { flashcards },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Flashcards error:', error)
    if (isBusyError(error)) {
      return NextResponse.json(
        { error: 'The AI is busy right now. Please try again in a minute.' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: 'Failed to generate flashcards' }, { status: 500 })
  }
}