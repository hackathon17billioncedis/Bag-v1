import { NextResponse } from 'next/server'
import { getUserMemory, appendMemoryNote, type MemoryItem } from '@/lib/persistence'
import { getSessionUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser?.id) {
    return NextResponse.json({ error: 'Sign in to view memory.' }, { status: 401 })
  }

  const result = await getUserMemory(sessionUser.id)
  if (!result.storageAvailable) {
    return NextResponse.json({ error: 'Storage unavailable.' }, { status: 503 })
  }

  return NextResponse.json({ items: result.items })
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser?.id) {
    return NextResponse.json({ error: 'Sign in to add memory.' }, { status: 401 })
  }

  let body: { text?: string; sourceChatId?: string }
  try {
    body = (await request.json()) as { text?: string; sourceChatId?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const text = body.text?.trim()
  if (!text) {
    return NextResponse.json({ error: 'Memory text is required.' }, { status: 400 })
  }

  const note: MemoryItem = {
    id: crypto.randomUUID(),
    text,
    createdAt: new Date().toISOString(),
    sourceChatId: body.sourceChatId ?? '',
  }

  const result = await appendMemoryNote(sessionUser.id, note)
  if (!result.storageAvailable) {
    return NextResponse.json({ error: 'Failed to save memory.' }, { status: 503 })
  }

  return NextResponse.json({ ok: true, item: note })
}
