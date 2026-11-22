import { NextResponse } from 'next/server'
import {
  updateMemoryItem,
  deleteMemoryItem,
} from '@/lib/persistence'
import { getSessionUserFromRequest } from '@/lib/auth'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser?.id) {
    return NextResponse.json({ error: 'Sign in to edit memory.' }, { status: 401 })
  }

  const { id } = await params
  const memoryId = id.trim()

  let body: { text?: string }
  try {
    body = (await request.json()) as { text?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const text = body.text?.trim()
  if (!text) {
    return NextResponse.json({ error: 'Memory text is required.' }, { status: 400 })
  }

  const result = await updateMemoryItem(sessionUser.id, memoryId, text)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 503 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser?.id) {
    return NextResponse.json({ error: 'Sign in to delete memory.' }, { status: 401 })
  }

  const { id } = await params
  const memoryId = id.trim()

  const result = await deleteMemoryItem(sessionUser.id, memoryId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 503 })
  }

  return NextResponse.json({ ok: true })
}
