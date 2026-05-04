import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getConversationHistory } from '@/lib/persistence'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId')
  const session = await auth()

  if (!userId && !session.userId) {
    return NextResponse.json({ error: 'Missing userId.' }, { status: 400 })
  }

  const history = await getConversationHistory(session.userId ?? userId ?? '')
  return NextResponse.json(history)
}
