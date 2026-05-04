'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCcw, Shield } from 'lucide-react'
import type { SessionUser } from '@/lib/auth'
import { apiUrl } from '@/lib/client-config'
import { GoogleSignInButton } from '@/components/google-sign-in-button'

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
      setError('Please sign in with Google first.')
      return
    }

    await loadOverview()
  }

  const totalModels = useMemo(() => {
    if (!overview) return []
    return Object.entries(overview.stats.modelCounts).sort((a, b) => b[1] - a[1])
  }, [overview])

  return (
    <main className="app-shell admin-shell">
      <div className="container">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              <Shield />
            </div>
            <div className="brand-copy">
              <span className="eyebrow">Portal</span>
              <h1>Bag-v1 admin dashboard</h1>
              <p>Monitor usage, model mix, and recent activity from one dedicated portal.</p>
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

        <section className="panel hero-card">
          <span className="eyebrow">Admin access</span>
          <h2>Open the Bag-v1 portal with the allowlisted Google account.</h2>
          <p className="helper">
            This dashboard stays separate from the assistant workspace. Sign in with the admin Gmail account to load the portal.
          </p>
        </section>

        <section className="panel image-panel">
          <form className="admin-login" onSubmit={handleSubmit}>
            <div>
              <div className="section-title">Access</div>
              <p className="section-subtitle">Sign in with the allowlisted Google account to open the dashboard.</p>
            </div>
            <div className="admin-toolbar">
              {sessionUser ? (
                <button className="button button-primary" type="submit" disabled={status === 'loading'}>
                  {status === 'loading' ? 'Loading...' : 'Open dashboard'}
                </button>
              ) : (
                <GoogleSignInButton
                  className="auth-button-wrap"
                  fullWidth={false}
                  onSuccess={async (signedInUser) => {
                  setSessionUser(signedInUser)
                    await loadOverview()
                  }}
                  />
              )}
            </div>
            <p className="meta-row">
              Current user: <code>{sessionUser?.email ?? 'signed out'}</code>
            </p>
            <p className="meta-row">
              Portal scope: <code>usage, models, users, persistence</code>
            </p>
            {error ? <div className="error">{error}</div> : null}
          </form>
        </section>

        {overview ? (
          <section className="admin-grid" style={{ marginTop: '1rem' }}>
            <div className="stats">
              <div className="stat">
                <strong>{overview.stats.chatCount}</strong>
                <span>Total chat turns</span>
              </div>
              <div className="stat">
                <strong>{overview.stats.imageCount}</strong>
                <span>Image generations</span>
              </div>
              <div className="stat">
                <strong>{overview.stats.userCount}</strong>
                <span>Tracked users</span>
              </div>
              <div className="stat">
                <strong>{overview.storageAvailable ? 'KV on' : 'KV off'}</strong>
                <span>Persistence status</span>
              </div>
            </div>

            <div className="layout" style={{ gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.1fr)' }}>
              <section className="panel image-panel">
                <div>
                  <div className="section-title">Model usage</div>
                  <p className="section-subtitle">How the current system is being used across models.</p>
                </div>
                <div className="quick-prompts">
                  {totalModels.length === 0 ? (
                    <span className="pill">No model data yet</span>
                  ) : (
                    totalModels.map(([modelName, count]) => (
                      <span key={modelName} className="pill">
                        {modelName}: {count}
                      </span>
                    ))
                  )}
                </div>
              </section>

              <section className="panel image-panel">
                <div>
                  <div className="section-title">Users</div>
                  <p className="section-subtitle">Most recent tracked users and their latest activity.</p>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>User ID</th>
                        <th>Messages</th>
                        <th>Last activity</th>
                        <th>Last model</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.users.length === 0 ? (
                        <tr>
                          <td colSpan={4}>No users yet.</td>
                        </tr>
                      ) : (
                        overview.users.map((user) => (
                          <tr key={user.userId}>
                            <td>
                              <code>{user.userId}</code>
                            </td>
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
      </div>
    </main>
  )
}
