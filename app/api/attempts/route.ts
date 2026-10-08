import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../lib/prisma'
import { getOrCreateUser } from '../../lib/getOrCreateUser'

type IncomingResult = {
  question?: unknown
  topic?: unknown
  selectedIndex?: unknown
  correctIndex?: unknown
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { noteId, roomId, score, total, results } = await req.json()

    if (typeof noteId !== 'string' || typeof roomId !== 'string') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Clean up per-question results. isCorrect is computed here on the
    // server so the client can't send a contradictory value.
    const cleanResults = Array.isArray(results)
      ? (results as IncomingResult[])
          .slice(0, 100)
          .filter(
            (r) =>
              typeof r.question === 'string' &&
              Number.isInteger(r.selectedIndex) &&
              Number.isInteger(r.correctIndex)
          )
          .map((r) => {
            const topic =
              typeof r.topic === 'string' && r.topic.trim()
                ? r.topic.trim().slice(0, 80)
                : null
            return {
              userId: user.id,
              noteId,
              question: (r.question as string).slice(0, 1000),
              topic,
              selectedIndex: r.selectedIndex as number,
              correctIndex: r.correctIndex as number,
              isCorrect: r.selectedIndex === r.correctIndex,
            }
          })
      : []

    // If we have per-question results, derive the score from them.
    // Otherwise fall back to the score/total sent by older clients.
    const finalTotal = cleanResults.length > 0 ? cleanResults.length : total
    const finalScore =
      cleanResults.length > 0
        ? cleanResults.filter((r) => r.isCorrect).length
        : score

    const attempt = await prisma.quizAttempt.create({
      data: {
        userId: user.id,
        noteId,
        roomId,
        score: finalScore,
        total: finalTotal,
        results: cleanResults.length > 0 ? { create: cleanResults } : undefined,
      },
    })

    return NextResponse.json(attempt)
  } catch (error) {
    console.error('Save attempt error:', error)
    return NextResponse.json({ error: 'Failed to save attempt' }, { status: 500 })
  }
}