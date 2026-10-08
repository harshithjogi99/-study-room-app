import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../lib/prisma'
import { GoogleGenAI } from '@google/genai'

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

// Tried in order. If the first is overloaded, the next is used.
const MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-3.6-flash']
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Below this many characters we assume the PDF is scanned (no real text layer)
const MIN_TEXT_LENGTH = 200
// Keeps the AI input fast even for huge documents
const MAX_INPUT_CHARS = 80000

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

// Fast local text extraction. Returns '' if it fails or the PDF is scanned.
async function extractTextLocally(arrayBuffer: ArrayBuffer): Promise<string> {
  let parser: any
  try {
    const { PDFParse } = await import('pdf-parse')
    parser = new PDFParse({ data: new Uint8Array(arrayBuffer) })
    const result = await parser.getText()
    return String(result?.text ?? '').trim()
  } catch (err) {
    console.error('Local PDF text extraction failed:', err)
    return ''
  } finally {
    try {
      await parser?.destroy?.()
    } catch {}
  }
}

export async function POST(req: NextRequest) {
  try {
    const started = Date.now()
    const { noteId, url } = await req.json()

    const fileRes = await fetch(url)
    if (!fileRes.ok) {
      return NextResponse.json({ error: 'Could not download the file.' }, { status: 400 })
    }
    const arrayBuffer = await fileRes.arrayBuffer()

    const localText = await extractTextLocally(arrayBuffer)
    console.log(
      `Summarize: local extraction found ${localText.length} chars in ${Date.now() - started}ms`
    )

    let summary = ''
    let fullText = ''

    if (localText.length >= MIN_TEXT_LENGTH) {
      // FAST PATH: the AI only reads text and writes a short summary
      const response = await generateWithRetry([
        {
          text: `Write a concise summary of these study notes in under 150 words, highlighting the key points. Return plain text only, no markdown and no headings.

Notes:
${localText.slice(0, MAX_INPUT_CHARS)}`,
        },
      ])
      summary = (response.text ?? '').trim()
      fullText = localText
    } else {
      // SLOW FALLBACK: scanned/image PDF, let Gemini read the PDF itself
      console.log('Summarize: using scanned-PDF fallback')
      const base64Data = Buffer.from(arrayBuffer).toString('base64')

      const response = await generateWithRetry([
        { inlineData: { mimeType: 'application/pdf', data: base64Data } },
        {
          text: `Do two things with this document:
1. Write a concise summary highlighting key points.
2. Transcribe the full text content of the document as accurately as possible.

Return ONLY valid JSON, no markdown formatting, no code fences, in this exact structure:
{ "summary": "...", "fullText": "..." }`,
        },
      ])

      let raw = response.text ?? '{}'
      raw = raw.replace(/```json|```/g, '').trim()

      try {
        const parsed = JSON.parse(raw)
        summary = parsed.summary ?? ''
        fullText = parsed.fullText ?? ''
      } catch {
        summary = raw
        fullText = ''
      }
    }

    const updated = await prisma.note.update({
      where: { id: noteId },
      data: {
        summary,
        extractedText: fullText,
      },
    })

    console.log(`Summarize: finished in ${Date.now() - started}ms`)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Summarize error:', error)
    if (isBusyError(error)) {
      return NextResponse.json(
        { error: 'The AI is busy right now. Please try again in a minute.' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: 'Failed to summarize' }, { status: 500 })
  }
}