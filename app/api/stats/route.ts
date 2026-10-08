import { NextResponse } from 'next/server'
import { prisma } from '../../lib/prisma'
import { getOrCreateUser } from '../../lib/getOrCreateUser'

export async function GET() {
  const user = await getOrCreateUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const attempts = await prisma.quizAttempt.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })

  const totalQuizzes = attempts.length
  const avgScore =
    totalQuizzes === 0
      ? 0
      : Math.round(
          (attempts.reduce((acc, a) => acc + a.score / a.total, 0) / totalQuizzes) * 100
        )

  // Calculate streak: consecutive days (including today) with at least one attempt
  const dayStrings = Array.from(
    new Set(attempts.map((a) => a.createdAt.toISOString().slice(0, 10)))
  ).sort((a, b) => (a < b ? 1 : -1)) // newest first

  let streak = 0
  const today = new Date()
  for (let i = 0; i < dayStrings.length; i++) {
    const expected = new Date(today)
    expected.setDate(today.getDate() - i)
    const expectedStr = expected.toISOString().slice(0, 10)
    if (dayStrings[i] === expectedStr) {
      streak++
    } else {
      break
    }
  }

  return NextResponse.json({ totalQuizzes, avgScore, streak })
}