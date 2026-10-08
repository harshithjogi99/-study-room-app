import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../lib/prisma'
import { getOrCreateUser } from '../../lib/getOrCreateUser'
import { GoogleGenAI } from '@google/genai'

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

// Fastest first. If one is busy or too slow, the next is used.
const MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-3.6-flash']

const GEMINI_TIMEOUT_MS = 20_000
const PDF_TIMEOUT_MS = 15_000
const MAX_TEXT_CHARS = 30_000 // enough for a quiz, keeps the request small

const REVIEW_INTERVAL_DAYS = [0, 1, 3, 7, 14]
const DAY_MS = 24 * 60 * 60 * 1000

type GeneratedQuestion = {
  question: string
  options: string[]
  correctIndex: number
  topic: string
}

function cleanQuiz(raw: unknown): GeneratedQuestion[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (q: any) =>
        q &&
        typeof q.question === 'string' &&
        Array.isArray(q.options) &&
        q.options.length >= 2 &&
        q.options.every((o: unknown) => typeof o === 'string') &&
        Number.isInteger(q.correctIndex) &&
        q.correctIndex >= 0 &&
        q.correctIndex < q.options.length
    )
    .map((q: any) => ({
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      topic:
        typeof q.topic === 'string' && q.topic.trim()
          ? q.topic.trim().slice(0, 60)
          : 'General',
    }))
}

// Spaced repetition: topics the user got wrong before AND that are due now.
async function getDueTopics(userId: string): Promise<string[]> {
  try {
    const results = await prisma.questionResult.findMany({
      where: { userId, topic: { not: null } },
      select: { topic: true, isCorrect: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: 5000,
    })

    const byTopic = new Map<string, { isCorrect: boolean; createdAt: Date }[]>()
    for (const r of results) {
      const key = r.topic as string
      const list = byTopic.get(key) ?? []
      list.push({ isCorrect: r.isCorrect, createdAt: r.createdAt })
      byTopic.set(key, list)
    }

    const now = Date.now()
    const due: { topic: string; accuracy: number; daysSince: number }[] = []

    for (const [topic, answers] of byTopic) {
      if (!answers.some((a) => !a.isCorrect)) continue

      let streak = 0
      for (let i = answers.length - 1; i >= 0 && answers[i].isCorrect; i--) streak++

      const intervalDays =
        REVIEW_INTERVAL_DAYS[Math.min(streak, REVIEW_INTERVAL_DAYS.length - 1)]
      const lastAnswered = answers[answers.length - 1].createdAt.getTime()
      const daysSince = (now - lastAnswered) / DAY_MS

      if (daysSince >= intervalDays) {
        const correct = answers.filter((a) => a.isCorrect).length
        due.push({ topic, accuracy: correct / answers.length, daysSince })
      }
    }

    return due
      .sort((a, b) => a.accuracy - b.accuracy || b.daysSince - a.daysSince)
      .slice(0, 5)
      .map((d) => d.topic)
  } catch (err) {
    console.error('Due topics lookup failed:', err)
    return []
  }
}

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

function isTimeoutError(err: any): boolean {
  const msg = String(err?.message ?? err).toLowerCase()
  return err?.name === 'AbortError' || err?.name === 'TimeoutError' || msg.includes('abort') || msg.includes('timeout')
}

// Try each model: busy = one quick retry, too slow or failed = next model.
async function generateWithRetry(parts: any[]) {
  let lastError: unknown
  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const started = Date.now()
      try {
        const config: any = {
          responseMimeType: 'application/json',
          abortSignal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
        }
        // Turn off "thinking" on 2.5 models. A quiz doesn't need it, and it adds seconds.
        if (model.startsWith('gemini-2.5')) {
          config.thinkingConfig = { thinkingBudget: 0 }
        }
        const res = await genAI.models.generateContent({
          model,
          config,
          contents: [{ role: 'user', parts }],
        })
        console.log(`[quiz] ${model} succeeded in ${Date.now() - started}ms`)
        return res
      } catch (err) {
        lastError = err
        console.error(
          `[quiz] ${model} attempt ${attempt} failed after ${Date.now() - started}ms:`,
          (err as any)?.status ?? (err as any)?.name ?? err
        )
        if (isTimeoutError(err)) break // too slow: next model
        if (!isBusyError(err)) break // this model can't do it: next model
        if (attempt === 1) await sleep(700)
      }
    }
  }
  throw lastError
}

export async function POST(req: NextRequest) {
  const t0 = Date.now()
  try {
    const { noteId } = await req.json()

    // Run both database lookups at the same time
    const [user, note] = await Promise.all([
      getOrCreateUser(),
      prisma.note.findUnique({
        where: { id: noteId },
        select: { url: true, extractedText: true },
      }),
    ])
    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    const dueTopics = user ? await getDueTopics(user.id) : []
    console.log(`[quiz] lookups done at ${Date.now() - t0}ms, due topics:`, dueTopics)

    const personalization =
      dueTopics.length > 0
        ? `
Personalization: this student is due to review these topics: ${dueTopics.join(', ')}.
If the notes genuinely cover any of them, make up to 2 of the 5 questions about those topics, and reuse the exact topic name above in the "topic" field. If the notes do not cover them, ignore this and just write a normal quiz. Never invent content that is not in the notes.
`
        : ''

    const instructions = `Based on these study notes, create a 5-question multiple choice quiz to test understanding.

For each question, add a "topic": a short concept name (1 to 4 words, Title Case) naming the specific subject the question tests, such as "Dynamic Programming", "Cell Respiration" or "Newton's Laws". Use the same wording for the same concept across questions, and avoid vague tags like "General" or "Notes".
${personalization}
Return ONLY valid JSON, no markdown formatting, no code fences, in this exact structure:
[
  {
    "question": "...",
    "options": ["A", "B", "C", "D"],
    "correctIndex": 0,
    "topic": "..."
  }
]`

    let parts: any[]
    const savedText = note.extractedText?.trim() ?? ''

    if (savedText.length >= 200) {
      // FAST PATH: use the text saved earlier. No PDF download, no PDF reading.
      console.log(`[quiz] using saved text (${savedText.length} chars)`)
      parts = [
        {
          text: `Study notes:\n"""\n${savedText.slice(0, MAX_TEXT_CHARS)}\n"""\n\n${instructions}`,
        },
      ]
    } else {
      // SLOW PATH: no saved text yet, so send the PDF itself.
      console.log('[quiz] no saved text, sending the PDF (slower)')
      const fileRes = await fetch(note.url, { signal: AbortSignal.timeout(PDF_TIMEOUT_MS) })
      const arrayBuffer = await fileRes.arrayBuffer()
      parts = [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: Buffer.from(arrayBuffer).toString('base64'),
          },
        },
        { text: instructions },
      ]
    }

    const response = await generateWithRetry(parts)

    let quizText = response.text ?? '[]'
    quizText = quizText.replace(/```json|```/g, '').trim()

    const quiz = cleanQuiz(JSON.parse(quizText))
    if (quiz.length === 0) {
      return NextResponse.json({ error: 'Quiz generation returned no valid questions' }, { status: 502 })
    }

    const updated = await prisma.note.update({
      where: { id: noteId },
      data: { quiz },
    })
    console.log(`[quiz] done in ${Date.now() - t0}ms`)

    return NextResponse.json(updated)
  } catch (error) {
    console.error(`[quiz] failed after ${Date.now() - t0}ms:`, error)
    if (isBusyError(error) || isTimeoutError(error)) {
      return NextResponse.json(
        { error: 'The AI is busy or slow right now. Please try again in a minute.' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: 'Failed to generate quiz' }, { status: 500 })
  }
}