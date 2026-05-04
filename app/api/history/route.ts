import { NextResponse } from 'next/server'
import { getConversationHistory } from '@/lib/persistence'
import { getSessionUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId')
  const sessionUser = await getSessionUserFromRequest(request)

  if (!userId && !sessionUser?.id) {
    return NextResponse.json({ error: 'Missing userId.' }, { status: 400 })
  }

  const history = await getConversationHistory(sessionUser?.id ?? userId ?? '')
  return NextResponse.json(history)
}
