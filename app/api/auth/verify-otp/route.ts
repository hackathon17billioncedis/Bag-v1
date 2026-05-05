import { NextResponse } from 'next/server';
import { createSessionToken, validateOTP, AUTH_COOKIE_NAME } from '@/lib/auth';

type VerifyOTPRequest = {
  email: string;
  otp: string;
};

export async function POST(request: Request) {
  let body: VerifyOTPRequest;

  try {
    body = (await request.json()) as VerifyOTPRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.email || !body.otp) {
    return NextResponse.json({ error: 'Email and OTP are required.' }, { status: 400 });
  }

  // Validate the OTP
  const isValid = validateOTP(body.email, body.otp);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid or expired OTP.' }, { status: 401 });
  }

  try {
    // Generate a unique user ID (in a real app, you'd likely look up the user from a database)
    const user = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email: body.email,
      name: body.email.split('@')[0], // Use part before @ as name
      picture: null,
    };

    // Create session token
    const token = await createSessionToken(user);

    // Return success response with session cookie
    const response = NextResponse.json({ user });
    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'OTP verification failed.',
      },
      { status: 500 }
    );
  }
}