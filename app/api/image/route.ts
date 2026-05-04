import { NextResponse } from 'next/server'
import { IMAGE_MODEL } from '@/lib/models'
import { appendImagePrompt } from '@/lib/persistence'
import { getSessionUserFromRequest } from '@/lib/auth'

type ImageRequest = {
  prompt?: string
  userId?: string
  userEmail?: string
}

const OPENROUTER_IMAGE_URL = 'https://openrouter.ai/api/v1/images/generations'

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENROUTER_API_KEY is not configured.' },
      { status: 500 },
    )
  }

  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser) {
    return NextResponse.json(
      { error: 'Please sign in to generate images.' },
      { status: 401 },
    )
  }

  let body: ImageRequest
  try {
    body = (await request.json()) as ImageRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const prompt = body.prompt?.trim()
  const userId = sessionUser.id.trim()
  const userEmail = sessionUser.email.trim()
  if (!prompt) {
    return NextResponse.json({ error: 'Please provide a prompt.' }, { status: 400 })
  }

  const response = await fetch(OPENROUTER_IMAGE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.SITE_URL ?? process.env.APP_URL ?? 'http://localhost:3000',
      'X-Title': process.env.APP_NAME ?? 'Bag-v1',
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      n: 1,
      size: '1024x1024',
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    return NextResponse.json(
      {
        error: `Image generation failed with status ${response.status}.`,
        details: errorText,
      },
      { status: response.status },
    )
  }

  const result = (await response.json()) as {
    data?: Array<{ url?: string }>
  }

  const imageUrl = result.data?.[0]?.url
  if (!imageUrl) {
    return NextResponse.json(
      { error: 'The model did not return an image URL.' },
      { status: 502 },
    )
  }

  await appendImagePrompt(userId, prompt, IMAGE_MODEL, userEmail)

  return NextResponse.json({
    imageUrl,
    model: IMAGE_MODEL,
  })
}
