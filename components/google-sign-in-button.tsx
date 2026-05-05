'use client'

import { useEffect, useRef, useState } from 'react'
import { apiUrl } from '@/lib/client-config'
import type { SessionUser } from '@/lib/auth'

type GoogleAccount = {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string
        callback: (response: { credential?: string }) => void
        auto_select?: boolean
        cancel_on_tap_outside?: boolean
      }) => void
      renderButton: (
        element: HTMLElement | null,
        options: {
          theme: 'outline' | 'filled_blue' | 'filled_black'
          size: 'large' | 'medium' | 'small'
          shape: 'rectangular' | 'pill' | 'circle' | 'square'
          text: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
          width?: number | string
        },
      ) => void
      prompt: () => void
    }
  }
}

declare global {
  interface Window {
    google?: GoogleAccount
  }
}

type Props = {
  onSuccess: (user: SessionUser) => Promise<void> | void
  className?: string
  fullWidth?: boolean
}

export function GoogleSignInButton({ onSuccess, className, fullWidth = false }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const onSuccessRef = useRef(onSuccess)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    onSuccessRef.current = onSuccess
  }, [onSuccess])

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) {
      return
    }

    const renderButton = () => {
      const google = window.google
      if (!google || !containerRef.current) {
        return false
      }

      containerRef.current.innerHTML = ''

      google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          if (!response.credential) {
            return
          }

          const authResponse = await fetch(apiUrl('/api/auth/google'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ credential: response.credential }),
          })

          if (!authResponse.ok) {
            return
          }

          const payload = (await authResponse.json().catch(() => ({}))) as { user?: SessionUser }
          if (payload.user) {
            await onSuccessRef.current(payload.user)
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      })

      google.accounts.id.renderButton(containerRef.current, {
        theme: 'filled_blue',
        size: 'large',
        shape: 'pill',
        text: 'signin_with',
        width: fullWidth ? Math.max(containerRef.current.clientWidth, 280) : 280,
      })

      setReady(true)
      return true
    }

    if (renderButton()) {
      return
    }

    const interval = window.setInterval(() => {
      if (renderButton()) {
        window.clearInterval(interval)
      }
    }, 120)

    return () => {
      window.clearInterval(interval)
    }
  }, [fullWidth])

  return (
    <div className={className}>
      <div ref={containerRef} />
      {!ready ? <span className="meta-row">Loading Google sign-in...</span> : null}
    </div>
  )
}

// This file has been replaced with email-otp-auth.tsx
// Google authentication has been removed in favor of email OTP authentication
