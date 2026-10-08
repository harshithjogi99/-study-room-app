import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { url, question } = await req.json()

    // Download the PDF
    const fileRes = await fetch(url)
    const arrayBuffer = await fileRes.arrayBuffer()
    const base64Data = Buffer.from(arrayBuffer).toString('base64')

    // Send PDF + question to Gemini
    const response = await genAI.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: base64Data,
              },
            },
            {
              text: `Based only on this document, answer the following question concisely. If the answer isn't in the document, say so clearly.\n\nQuestion: ${question}`,
            },
          ],
        },
      ],
    })

    const answer = response.text ?? 'No answer generated.'

    return NextResponse.json({ answer })
  } catch (error) {
    console.error('Ask error:', error)
    return NextResponse.json({ error: 'Failed to get answer' }, { status: 500 })
  }
}