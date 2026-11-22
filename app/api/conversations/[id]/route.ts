import { NextResponse } from 'next/server'
import {
  renameThread,
  deleteThread,
  duplicateThread,
  listConversations,
} from '@/lib/persistence'
import { getSessionUserFromRequest } from '@/lib/auth'

type RenameBody = {
  title?: string
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser?.id) {
    return NextResponse.json({ error: 'Sign in to modify a chat thread.' }, { status: 401 })
  }

  const { id } = await params
  const threadId = id.trim()

  let body: RenameBody
  try {
    body = (await request.json()) as RenameBody
  } catch {
    body = {}
  }

  const newTitle = body.title?.trim()
  if (!newTitle) {
    return NextResponse.json({ error: 'Title is required.' }, { status: 400 })
  }

  const result = await renameThread(sessionUser.id, threadId, newTitle)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 503 })
  }

  const updated = await listConversations(sessionUser.id)
  const thread = updated.threads.find((t) => t.id === threadId)
  return NextResponse.json({ thread })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser?.id) {
    return NextResponse.json({ error: 'Sign in to delete a chat thread.' }, { status: 401 })
  }

  const { id } = await params
  const threadId = id.trim()

  const result = await deleteThread(sessionUser.id, threadId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 503 })
  }

  return NextResponse.json({ ok: true })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser?.id) {
    return NextResponse.json({ error: 'Sign in to duplicate a chat thread.' }, { status: 401 })
  }

  const { id } = await params
  const threadId = id.trim()

  const result = await duplicateThread(sessionUser.id, threadId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 503 })
  }

  return NextResponse.json({ threadId: result.threadId })
}
