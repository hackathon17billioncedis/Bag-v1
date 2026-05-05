import { NextResponse } from 'next/server'
import { getConversationHistory } from '@/lib/persistence'
import { getSessionUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const chatId = url.searchParams.get('chatId') ?? undefined
  const sessionUser = await getSessionUserFromRequest(request)

  if (!sessionUser?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const history = await getConversationHistory(sessionUser.id, chatId)
  return NextResponse.json(history)
}
