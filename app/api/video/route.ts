import { NextResponse } from 'next/server'
import { DEFAULT_VIDEO_MODEL } from '@/lib/models'
import { NVIDIA_BASE_URL, getNvidiaApiKey } from '@/lib/nvidia'
import { getSessionUserFromRequest } from '@/lib/auth'

type VideoRequest = {
  prompt?: string
  model?: string
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser) {
    return NextResponse.json(
      { error: 'Please sign in to generate videos.' },
      { status: 401 },
    )
  }

  let body: VideoRequest
  try {
    body = (await request.json()) as VideoRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const prompt = body.prompt?.trim()
  if (!prompt) {
    return NextResponse.json({ error: 'Please provide a prompt.' }, { status: 400 })
  }

  const model = body.model?.trim() || DEFAULT_VIDEO_MODEL

  const apiKey = getNvidiaApiKey()

  const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      stream: false,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    return NextResponse.json(
      {
        error: `Video generation request failed with status ${response.status}.`,
        details: errorText,
      },
      { status: response.status },
    )
  }

  const result = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string
      }
    }>
  }

  const content = result.choices?.[0]?.message?.content ?? ''
  if (!content) {
    return NextResponse.json(
      { error: 'The model did not return a result.' },
      { status: 502 },
    )
  }

  return NextResponse.json({
    result: content,
    model,
  })
}