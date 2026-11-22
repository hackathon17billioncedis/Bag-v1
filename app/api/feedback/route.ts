import { NextResponse } from 'next/server'
import { createFeedback, getFeedback } from '@/lib/persistence'
import { getSessionUserFromRequest } from '@/lib/auth'

type FeedbackRequest = {
  threadId?: string
  messageIndex?: number
  rating?: 1 | -1
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser?.id) {
    return NextResponse.json({ error: 'Sign in to send feedback.' }, { status: 401 })
  }

  let body: FeedbackRequest
  try {
    body = (await request.json()) as FeedbackRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const threadId = body.threadId?.trim()
  const messageIndex = body.messageIndex
  const rating = body.rating

  if (!threadId || messageIndex === undefined || !rating) {
    return NextResponse.json(
      { error: 'threadId, messageIndex, and rating are required.' },
      { status: 400 },
    )
  }

  if (rating !== 1 && rating !== -1) {
    return NextResponse.json({ error: 'Rating must be 1 or -1.' }, { status: 400 })
  }

  const result = await createFeedback(sessionUser.id, threadId, messageIndex, rating)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 503 })
  }

  return NextResponse.json({ ok: true })
}

export async function GET(request: Request) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser?.id) {
    return NextResponse.json({ error: 'Sign in to view feedback.' }, { status: 401 })
  }

  const url = new URL(request.url)
  const threadId = url.searchParams.get('threadId') ?? undefined

  const result = await getFeedback(sessionUser.id, threadId)
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 503 })
  }

  return NextResponse.json({ entries: result.entries })
}
