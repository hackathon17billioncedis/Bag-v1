'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { UserButton, useUser } from '@clerk/nextjs'
import { ArrowLeft, Shield, RefreshCcw } from 'lucide-react'

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

const ADMIN_EMAIL_KEY = 'bag-v1-admin-email'

export default function AdminPage() {
  const { user, isLoaded } = useUser()
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState('')
  const [overview, setOverview] = useState<AdminOverview | null>(null)

  useEffect(() => {
    const stored = window.localStorage.getItem(ADMIN_EMAIL_KEY)
    if (stored) {
      void loadOverview(stored)
    }
  }, [])

  const loadOverview = async (adminEmail: string) => {
    setStatus('loading')
    setError('')

    try {
      const response = await fetch(`/api/admin/overview?email=${encodeURIComponent(adminEmail)}`)
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextEmail = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || ''
    if (!nextEmail) {
      setError('Please sign in with Gmail first.')
      return
    }
    window.localStorage.setItem(ADMIN_EMAIL_KEY, nextEmail)
    await loadOverview(nextEmail)
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
              <span className="eyebrow">Admin dashboard</span>
              <h1>Bag-v1 control center</h1>
              <p>Track usage, model mix, and user activity from the storage layer.</p>
            </div>
          </div>
          <div className="toolbar-right">
            <Link className="button button-ghost" href="/">
              <ArrowLeft size={16} /> Back to chat
            </Link>
            {user ? (
              <UserButton />
            ) : (
              <Link className="button button-ghost" href={'/sign-in' as Route}>
                Sign in
              </Link>
            )}
            {overview ? (
              <button className="button button-ghost" type="button" onClick={() => loadOverview(user?.primaryEmailAddress?.emailAddress || '')}>
                <RefreshCcw size={16} /> Refresh
              </button>
            ) : null}
          </div>
        </header>

        <section className="panel image-panel">
          <form className="admin-login" onSubmit={handleSubmit}>
            <div>
              <div className="section-title">Access</div>
              <p className="section-subtitle">
                Sign in with the allowlisted Gmail address to open the dashboard.
              </p>
            </div>
            <div className="admin-toolbar">
              {user ? (
                <button className="button button-primary" type="submit" disabled={status === 'loading' || !isLoaded}>
                  {status === 'loading' ? 'Loading...' : 'Open dashboard'}
                </button>
              ) : (
                <>
                  <Link className="button button-primary" href={'/sign-in' as Route}>
                    Sign in with Google
                  </Link>
                  <Link className="button button-ghost" href={'/sign-up' as Route}>
                    Create account
                  </Link>
                </>
              )}
            </div>
            <p className="meta-row">
              Allowed admin email: <code>baginifred26@gmail.com</code>
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

            <section className="panel image-panel">
              <div>
                <div className="section-title">Model usage</div>
                <p className="section-subtitle">How the current system is being used across models.</p>
              </div>
              <div className="quick-prompts">
                {totalModels.length === 0 ? (
                  <span className="pill">No model data yet</span>
                ) : (
                  totalModels.map(([model, count]) => (
                    <span key={model} className="pill">
                      {model}: {count}
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
                          <td><code>{user.userId}</code></td>
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
          </section>
        ) : null}
      </div>
    </main>
  )
}
