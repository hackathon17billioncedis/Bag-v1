import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { getAdminOverview } from '@/lib/persistence'

export async function GET() {
  const adminEmail = process.env.ADMIN_EMAIL ?? ''
  const user = await currentUser()
  const email = user?.primaryEmailAddress?.emailAddress ?? ''

  if (!adminEmail) {
    return NextResponse.json(
      { error: 'ADMIN_EMAIL is not configured.' },
      { status: 500 },
    )
  }

  if (email.toLowerCase().trim() !== adminEmail.toLowerCase().trim()) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const overview = await getAdminOverview()
  return NextResponse.json(overview)
}
