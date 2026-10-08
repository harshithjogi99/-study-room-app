import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { auth, currentUser } from '@clerk/nextjs/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params

  const messages = await prisma.chatMessage.findMany({
    where: { roomId },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(messages)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const { userId: clerkId } = await auth()

  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Look up the matching Prisma User record by Clerk ID
  const dbUser = await prisma.user.findUnique({
    where: { clerkId },
  })

  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const clerkUser = await currentUser()
  const userName = clerkUser?.firstName || clerkUser?.username || 'Anonymous'

  const { content } = await req.json()

  const message = await prisma.chatMessage.create({
    data: { roomId, userId: dbUser.id, userName, content },
  })

  return NextResponse.json(message)
}