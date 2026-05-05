import { NextResponse } from 'next/server'
import {
  createConversationThread,
  getUserMemory,
  listConversations,
  normalizeTitle,
} from '@/lib/persistence'
import { getSessionUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser?.id) {
    return NextResponse.json({ threads: [], memory: [], activeChatId: '' })
  }

  const [conversations, memory] = await Promise.all([
    listConversations(sessionUser.id),
    getUserMemory(sessionUser.id),
  ])

  return NextResponse.json({
    threads: conversations.threads,
    memory: memory.items,
    activeChatId: conversations.activeChatId,
  })
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser?.id) {
    return NextResponse.json({ error: 'Sign in to create a chat thread.' }, { status: 401 })
  }

  let body: { chatId?: string; title?: string; model?: string }
  try {
    body = (await request.json()) as { chatId?: string; title?: string; model?: string }
  } catch {
    body = {}
  }

  const chatId = body.chatId?.trim() || crypto.randomUUID()
  const title = normalizeTitle(body.title?.trim() || 'New chat')

  const result = await createConversationThread(sessionUser.id, chatId, title, body.model)
  if (!result.storageAvailable) {
    return NextResponse.json({ error: 'Conversation storage is unavailable.' }, { status: 503 })
  }

  return NextResponse.json({ thread: result.thread })
}
