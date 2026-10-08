import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params

  const notes = await prisma.note.findMany({
    where: { roomId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(notes)
}