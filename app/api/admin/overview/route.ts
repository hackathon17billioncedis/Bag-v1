import { NextResponse } from 'next/server'
import { getAdminOverview, ensureExtendedTables } from '@/lib/persistence'
import { getSessionUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  await ensureExtendedTables()
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
  const isAllowlisted = adminEmails.includes(email.toLowerCase().trim())

  // Check is_admin flag in DB if available
  let isDbAdmin = false
  try {
    const { neon } = await import('@neondatabase/serverless')
    const sql = neon(process.env.DATABASE_URL!)
    const rows = await sql`
      SELECT is_admin FROM bag_users WHERE user_id = ${user?.id ?? ''}
    `
    const isAdminRow = rows[0] as { is_admin?: boolean | string } | undefined
    isDbAdmin = isAdminRow?.is_admin === true || isAdminRow?.is_admin === 'true'
  } catch {
    // Ignore DB check failures
  }

  if (!isAllowlisted && !isDbAdmin) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const overview = await getAdminOverview()
  return NextResponse.json(overview)
}
