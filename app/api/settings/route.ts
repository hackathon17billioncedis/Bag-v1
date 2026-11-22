import { NextResponse } from 'next/server'
import {
  getUserSettings,
  updateUserSetting,
  ensureExtendedTables,
} from '@/lib/persistence'
import { getSessionUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser?.id) {
    return NextResponse.json({ error: 'Sign in to view settings.' }, { status: 401 })
  }

  await ensureExtendedTables()
  const result = await getUserSettings(sessionUser.id)
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 503 })
  }

  return NextResponse.json({ settings: result.settings })
}

export async function PATCH(request: Request) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser?.id) {
    return NextResponse.json({ error: 'Sign in to update settings.' }, { status: 401 })
  }

  let body: { settings?: Record<string, string> }
  try {
    body = (await request.json()) as { settings?: Record<string, string> }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const settings = body.settings
  if (!settings || typeof settings !== 'object') {
    return NextResponse.json({ error: 'Settings object is required.' }, { status: 400 })
  }

  await ensureExtendedTables()
  for (const [key, value] of Object.entries(settings)) {
    const result = await updateUserSetting(sessionUser.id, key, value)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 503 })
    }
  }

  return NextResponse.json({ ok: true })
}
