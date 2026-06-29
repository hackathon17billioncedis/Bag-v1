import { NextResponse } from 'next/server'
import { DEFAULT_TTS_MODEL } from '@/lib/models'
import { NVIDIA_BASE_URL, getNvidiaApiKey } from '@/lib/nvidia'
import { getSessionUserFromRequest } from '@/lib/auth'

type TTSRequest = {
  text?: string
  model?: string
  voice?: string
  language?: string
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser) {
    return NextResponse.json(
      { error: 'Please sign in to use text-to-speech.' },
      { status: 401 },
    )
  }

  let body: TTSRequest
  try {
    body = (await request.json()) as TTSRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const text = body.text?.trim()
  if (!text) {
    return NextResponse.json({ error: 'Please provide text to speak.' }, { status: 400 })
  }

  const model = body.model?.trim() || DEFAULT_TTS_MODEL

  const apiKey = getNvidiaApiKey()

  const payload: Record<string, unknown> = {
    model,
    input: text,
    voice: body.voice || 'default',
    response_format: 'mp3',
  }

  if (body.language) {
    payload.language = body.language
  }

  const response = await fetch(`${NVIDIA_BASE_URL}/audio/speech`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text()

    if (response.status === 404) {
      return NextResponse.json(
        { error: 'TTS endpoint not available on the current model. Try /chat/completions fallback not implemented.' },
        { status: 502 },
      )
    }

    return NextResponse.json(
      {
        error: `TTS request failed with status ${response.status}.`,
        details: errorText,
      },
      { status: response.status },
    )
  }

  const audioBuffer = await response.arrayBuffer()

  return new NextResponse(audioBuffer, {
    status: 200,
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'audio/mpeg',
      'Cache-Control': 'no-cache',
    },
  })
}