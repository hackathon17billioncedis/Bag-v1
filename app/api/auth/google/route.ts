import { NextResponse } from 'next/server'
import { createSessionToken, verifyGoogleCredential, AUTH_COOKIE_NAME } from '@/lib/auth'

type GoogleAuthRequest = {
  credential?: string
}

export async function POST(request: Request) {
  let body: GoogleAuthRequest

  try {
    body = (await request.json()) as GoogleAuthRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.credential) {
    return NextResponse.json({ error: 'Missing Google credential.' }, { status: 400 })
  }

  try {
    const user = await verifyGoogleCredential(body.credential)
    const token = await createSessionToken(user)

    const response = NextResponse.json({ user })
    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })

    return response
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Google sign-in failed.',
      },
      { status: 401 },
    )
  }
}
