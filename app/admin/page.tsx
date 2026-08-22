'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Database, ImageIcon, MessageSquare, RefreshCcw, Shield, Users } from 'lucide-react'
import type { SessionUser } from '@/lib/auth'
import { apiUrl } from '@/lib/client-config'
import { EmailOTPAuth } from '@/components/email-otp-auth'
import { ModelUsageChart } from '@/components/model-usage-chart'

type AdminOverview = {
  storageAvailable: boolean
  stats: {
    chatCount: number
    imageCount: number
    userCount: number
    modelCounts: Record<string, number>
  }
  users: Array<{
    userId: string
    messageCount: number
    lastActivityAt: string | null
    lastModel: string | null
    lastEmail: string | null
  }>
}

export default function AdminPage() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState('')
  const [overview, setOverview] = useState<AdminOverview | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(apiUrl('/api/auth/me'))
        if (!response.ok) {
          return
        }

        const payload = (await response.json()) as { user: SessionUser | null }
        setSessionUser(payload.user)
      } catch {
        // Ignore auth bootstrap errors and let the login card show.
      }
    })()
  }, [])

  const loadOverview = async () => {
    setStatus('loading')
    setError('')

    try {
      const response = await fetch(apiUrl('/api/admin/overview'))
      const payload = (await response.json()) as AdminOverview | { error: string }

      if (!response.ok) {
        throw new Error('error' in payload ? payload.error : 'Failed to load admin overview.')
      }

      if ('stats' in payload) {
        setOverview(payload)
        setStatus('ready')
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Admin load failed.')
      setStatus('error')
    }
  }

  useEffect(() => {
    if (sessionUser?.email) {
      void loadOverview()
    }
  }, [sessionUser?.email])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!sessionUser?.email) {
      setError('Please sign in with your admin email first.')
      return
    }

    await loadOverview()
  }

  return (
    <main className="app-shell admin-shell">
      <div className="container admin-container">
        <header className="topbar admin-topbar">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              <Shield />
            </div>
            <div className="brand-copy">
              <h1>Admin</h1>
            </div>
          </div>
          <div className="toolbar-right">
            <Link className="button button-ghost" href="/">
              <ArrowLeft size={16} /> Back to chat
            </Link>
            {sessionUser ? (
              <button
                className="button button-ghost"
                type="button"
                onClick={async () => {
                  await fetch(apiUrl('/api/auth/logout'), { method: 'POST' })
                  setSessionUser(null)
                  setOverview(null)
                }}
              >
                <RefreshCcw size={16} /> Sign out
              </button>
            ) : null}
          </div>
        </header>

        {!sessionUser ? (
          <section className="admin-login-shell">
            <form className="panel admin-login-card" onSubmit={handleSubmit}>
              <div>
                <div className="section-title">Admin access</div>
                <p className="section-subtitle">Use the allowlisted email address.</p>
              </div>
              <EmailOTPAuth
                className="auth-button-wrap"
                fullWidth
                onSuccess={async (signedInUser) => {
                  setSessionUser(signedInUser)
                  await loadOverview()
                }}
              />
              {error ? <div className="error">{error}</div> : null}
            </form>
          </section>
        ) : null}

        {overview ? (
          <section className="admin-grid">
            <div className="stats">
              <div className="stat">
                <MessageSquare size={18} />
                <strong>{overview.stats.chatCount}</strong>
                <span>Chat turns</span>
              </div>
              <div className="stat">
                <ImageIcon size={18} />
                <strong>{overview.stats.imageCount}</strong>
                <span>Images</span>
              </div>
              <div className="stat">
                <Users size={18} />
                <strong>{overview.stats.userCount}</strong>
                <span>Users</span>
              </div>
              <div className="stat">
                <Database size={18} />
                <strong>{overview.storageAvailable ? 'Storage on' : 'Storage off'}</strong>
                <span>Persistence</span>
              </div>
            </div>

            <div className="admin-content-grid">
              <ModelUsageChart modelCounts={overview.stats.modelCounts} />

              <section className="panel admin-panel">
                <div>
                  <div className="section-title">Users</div>
                </div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>User ID</th>
                        <th>Email</th>
                        <th>Messages</th>
                        <th>Last activity</th>
                        <th>Last model</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.users.length === 0 ? (
                        <tr>
                          <td colSpan={5}>No users yet.</td>
                        </tr>
                      ) : (
                        overview.users.map((user) => (
                          <tr key={user.userId}>
                            <td>
                              <code>{user.userId}</code>
                            </td>
                            <td>{user.lastEmail ?? 'n/a'}</td>
                            <td>{user.messageCount}</td>
                            <td>{user.lastActivityAt ?? 'n/a'}</td>
                            <td>{user.lastModel ?? 'n/a'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </section>
        ) : null}

        {sessionUser && !overview ? (
          <section className="admin-login-shell">
            <form className="panel admin-login-card" onSubmit={handleSubmit}>
              <div>
                <div className="section-title">Dashboard</div>
                <p className="section-subtitle">Signed in as {sessionUser.email}</p>
              </div>
              <button className="button button-primary" type="submit" disabled={status === 'loading'}>
                {status === 'loading' ? 'Loading...' : 'Open dashboard'}
              </button>
              {error ? <div className="error">{error}</div> : null}
            </form>
          </section>
        ) : null}
      </div>
    </main>
  )
}
