import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { generateOTP, hashOTP, storeOTP } from '@/lib/auth'

type SendOTPRequest = {
  email?: string
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim()
  const port = Number(process.env.SMTP_PORT ?? 587)
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASSWORD?.trim()
  const from = process.env.SMTP_FROM?.trim() || user

  if (!host || !user || !pass || !from) {
    throw new Error('SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM are required.')
  }

  return {
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: {
      user,
      pass,
    },
    from,
  }
}

export async function POST(request: Request) {
  let body: SendOTPRequest

  try {
    body = (await request.json()) as SendOTPRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const email = body.email?.trim() ?? ''

  if (!email) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Invalid email format.' }, { status: 400 })
  }

  try {
    const otp = generateOTP()
    const hashedOtp = hashOTP(otp)

    const smtp = getSmtpConfig()
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.auth,
    })

    await transporter.sendMail({
      from: smtp.from,
      to: email,
      subject: 'Your Bag-v1 login code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #0f172a;">
          <h2 style="margin: 0 0 12px;">Hello,</h2>
          <p style="margin: 0 0 16px; line-height: 1.6;">
            Use this one-time code to sign in to Bag-v1.
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <span style="display: inline-block; font-size: 28px; font-weight: 700; padding: 14px 26px; background: #eef2ff; border-radius: 12px; letter-spacing: 6px;">
              ${otp}
            </span>
          </div>
          <p style="margin: 0 0 12px; line-height: 1.6;">
            This code expires in 10 minutes. If you did not request it, you can ignore this email.
          </p>
          <p style="font-size: 12px; color: #64748b;">Bag-v1 authentication</p>
        </div>
      `,
    })

    storeOTP(email, hashedOtp)

    return NextResponse.json({ message: 'OTP sent successfully.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send OTP.'
    const isAuthError =
      /535|Username and Password not accepted|Invalid login|EAUTH/i.test(message) ||
      (error && typeof error === 'object' && 'code' in error && String((error as { code?: string }).code) === 'EAUTH')

    return NextResponse.json(
      {
        error: isAuthError
          ? 'SMTP authentication failed. If you are using Gmail, turn on 2-Step Verification and use a Google App Password, not your regular password.'
          : message,
      },
      { status: isAuthError ? 502 : 500 },
    )
  }
}
