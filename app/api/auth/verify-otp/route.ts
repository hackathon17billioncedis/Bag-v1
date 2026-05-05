import { NextResponse } from 'next/server'
import { AUTH_COOKIE_NAME, createSessionToken, validateOTP } from '@/lib/auth'

type VerifyOTPRequest = {
  email?: string
  username?: string
  otp?: string
}

export async function POST(request: Request) {
  let body: VerifyOTPRequest

  try {
    body = (await request.json()) as VerifyOTPRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const email = body.email?.trim() ?? ''
  const username = body.username?.trim() ?? ''
  const otp = body.otp?.trim() ?? ''

  if (!email || !username || !otp) {
    return NextResponse.json({ error: 'Username, email, and OTP are required.' }, { status: 400 })
  }

  const isValid = validateOTP(email, otp, username)
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid or expired OTP.' }, { status: 401 })
  }

  try {
    const user = {
      id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      email,
      name: username,
      picture: null,
    }

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
        error: error instanceof Error ? error.message : 'OTP verification failed.',
      },
      { status: 500 },
    )
  }
}
