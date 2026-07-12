import { NextResponse } from 'next/server'
import { getAdminOverview } from '@/lib/persistence'
import { getSessionUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  const rawAdminEmails = process.env.ADMIN_EMAIL ?? ''
  const user = await getSessionUserFromRequest(request)
  const email = user?.email ?? ''

  if (!rawAdminEmails) {
    return NextResponse.json(
      { error: 'ADMIN_EMAIL is not configured.' },
      { status: 500 },
    )
  }

  const adminEmails = rawAdminEmails.split(',').map(e => e.toLowerCase().trim())
  if (!adminEmails.includes(email.toLowerCase().trim())) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const overview = await getAdminOverview()
  return NextResponse.json(overview)
}
