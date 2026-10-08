import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../lib/prisma'
import { GoogleGenAI } from '@google/genai'

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const roomId = searchParams.get('roomId')

  if (!roomId) {
    return NextResponse.json({ error: 'roomId required' }, { status: 400 })
  }

  const messages = await prisma.tutorMessage.findMany({
    where: { roomId },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(messages)
}

export async function POST(req: NextRequest) {
  try {
    const { roomId, question } = await req.json()

    const notes = await prisma.note.findMany({ where: { roomId } })

    const history = await prisma.tutorMessage.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    const orderedHistory = history.reverse()

    await prisma.tutorMessage.create({
      data: { roomId, role: 'user', content: question },
    })

    // Use cached extracted text when available; only download+send raw PDF
    // for notes that haven't been summarized yet (no cached text).
    const textParts: { text: string }[] = []
    const filePartsPromises: Promise<{ inlineData: { mimeType: string; data: string } }>[] = []

    for (const note of notes) {
      if (note.extractedText) {
        textParts.push({ text: `Document "${note.fileName}":\n${note.extractedText}` })
      } else {
        filePartsPromises.push(
          fetch(note.url)
            .then((res) => res.arrayBuffer())
            .then((buf) => ({
              inlineData: {
                mimeType: 'application/pdf',
                data: Buffer.from(buf).toString('base64'),
              },
            }))
        )
      }
    }

    const fileParts = await Promise.all(filePartsPromises)

    const conversationText = orderedHistory
      .map((m) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`)
      .join('\n')

    const response = await genAI.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        {
          role: 'user',
          parts: [
            ...textParts,
            ...fileParts,
            {
              text: `You are a helpful study tutor. You have access to the documents uploaded in this study room. Use them to help answer the student's questions, and reference the conversation history if relevant.

Conversation so far:
${conversationText}

Student's new question: ${question}

Answer clearly and helpfully, like a patient tutor would.`,
            },
          ],
        },
      ],
    })

    const answer = response.text ?? 'Sorry, I could not generate an answer.'

    const aiMessage = await prisma.tutorMessage.create({
      data: { roomId, role: 'ai', content: answer },
    })

    return NextResponse.json(aiMessage)
  } catch (error) {
    console.error('Tutor error:', error)
    return NextResponse.json({ error: 'Failed to get tutor response' }, { status: 500 })
  }
}