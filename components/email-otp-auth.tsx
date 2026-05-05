'use client'

import { useEffect, useState } from 'react'
import { apiUrl } from '@/lib/client-config'
import type { SessionUser } from '@/lib/auth'

type Props = {
  onSuccess: (user: SessionUser) => Promise<void> | void
  className?: string
  fullWidth?: boolean
}

export function EmailOTPAuth({ onSuccess, className, fullWidth = false }: Props) {
  const [step, setStep] = useState<'details' | 'otp'>('details')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (countdown <= 0) {
      return
    }

    const timer = window.setTimeout(() => {
      setCountdown((current) => Math.max(current - 1, 0))
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [countdown])

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  const sendOtp = async () => {
    const nextEmail = email.trim()

    if (!emailRegex.test(nextEmail)) {
      setError('Please enter a valid email address.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(apiUrl('/api/auth/send-otp'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: nextEmail }),
      })

      const result = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        throw new Error(result.error || 'Failed to send OTP.')
      }

      setStep('otp')
      setCountdown(60)
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'An error occurred.')
    } finally {
      setLoading(false)
    }
  }

  const verifyOtp = async () => {
    const nextEmail = email.trim()
    const nextOtp = otp.trim()

    if (!nextOtp) {
      setError('Please enter the OTP.')
      return
    }

    if (nextOtp.length !== 6) {
      setError('OTP must be 6 digits.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(apiUrl('/api/auth/verify-otp'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: nextEmail, otp: nextOtp }),
      })

      const result = (await response.json().catch(() => ({}))) as { error?: string; user?: SessionUser }
      if (!response.ok) {
        throw new Error(result.error || 'Invalid OTP.')
      }

      if (result.user) {
        await onSuccess(result.user)
      }
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'An error occurred.')
    } finally {
      setLoading(false)
    }
  }

  const resendOtp = async () => {
    if (countdown > 0) {
      return
    }

    await sendOtp()
  }

  const authHint = error.includes('AUTH_SECRET')
    ? 'Add AUTH_SECRET in Vercel environment variables, then redeploy.'
    : error.includes('SMTP authentication failed')
      ? 'For Gmail SMTP, use an App Password instead of your normal password.'
      : ''

  return (
    <div className={className}>
      {step === 'details' ? (
        <div className="email-input-section">
          <h3>Sign in or sign up</h3>
          <p className="meta-row">Enter your email to receive a one-time code.</p>

          <div className="input-stack">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="your@email.com"
              className="control"
              disabled={loading}
            />
            <button
              className="button button-primary"
              type="button"
              onClick={sendOtp}
              disabled={loading || !email}
              style={fullWidth ? { width: '100%' } : undefined}
            >
              {loading ? 'Sending...' : 'Send code'}
            </button>
          </div>
        </div>
      ) : (
        <div className="otp-input-section">
          <h3>Enter verification code</h3>
          <p className="meta-row">
            We sent a 6-digit code to <strong>{email}</strong>
          </p>

          <div className="input-stack">
            <input
              type="text"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              className="control"
              maxLength={6}
              disabled={loading}
            />
            <button
              className="button button-primary"
              type="button"
              onClick={verifyOtp}
              disabled={loading || otp.length !== 6}
              style={fullWidth ? { width: '100%' } : undefined}
            >
              {loading ? 'Verifying...' : 'Continue'}
            </button>
          </div>

          <div className="otp-actions">
            <button
              className="button button-ghost"
              type="button"
              onClick={resendOtp}
              disabled={loading || countdown > 0}
            >
              {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
            </button>

            <button
              className="button button-ghost"
              type="button"
              onClick={() => {
                setStep('details')
                setError('')
              }}
              disabled={loading}
            >
              Back
            </button>
          </div>
        </div>
      )}

      {error ? (
        <div className="error-message">
          <div>{error}</div>
          {authHint ? <div className="meta-row">{authHint}</div> : null}
        </div>
      ) : null}
    </div>
  )
}
