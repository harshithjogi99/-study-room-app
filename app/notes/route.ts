import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../lib/prisma'// adjust path to your existing prisma client
import { auth } from '@clerk/nextjs/server'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { roomId, url, fileName } = await req.json()

  const note = await prisma.note.create({
    data: { roomId, url, fileName, uploadedBy: userId },
  })

  return NextResponse.json(note)
}