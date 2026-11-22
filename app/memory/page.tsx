'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { X, Trash2, Edit3, Save, Plus, RefreshCcw, LoaderCircle } from 'lucide-react'
import type { MemoryItem } from '@/lib/persistence'
import { apiUrl } from '@/lib/client-config'
import type { SessionUser } from '@/lib/auth'

export default function MemoryPage() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null)
  const [items, setItems] = useState<MemoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const loadSession = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/api/auth/me'))
      if (response.ok) {
        const payload = (await response.json()) as { user: SessionUser | null }
        setSessionUser(payload.user)
      }
    } catch {
      // Ignore
    }
  }, [])

  const loadMemory = useCallback(async () => {
    if (!sessionUser?.id) return
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(apiUrl('/api/memory'))
      if (response.ok) {
        const payload = (await response.json()) as { items: MemoryItem[] }
        setItems(Array.isArray(payload.items) ? payload.items : [])
      } else {
        const payload = await response.json().catch(() => ({}))
        setError(payload.error || 'Failed to load memory.')
      }
    } catch {
      setError('Failed to load memory.')
    } finally {
      setIsLoading(false)
    }
  }, [sessionUser?.id])

  useEffect(() => {
    void loadSession()
    void loadMemory()
  }, [loadSession, loadMemory])

  const handleAdd = async () => {
    const text = window.prompt('Enter a memory note to save:')
    if (!text || !text.trim() || !sessionUser?.id) return

    try {
      const response = await fetch(apiUrl('/api/memory'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      })
      if (response.ok) {
        await loadMemory()
      } else {
        const payload = await response.json().catch(() => ({}))
        setError(payload.error || 'Failed to add memory.')
      }
    } catch {
      setError('Failed to add memory.')
    }
  }

  const handleEditStart = (item: MemoryItem) => {
    setEditingId(item.id)
    setEditText(item.text)
  }

  const handleEditCancel = () => {
    setEditingId(null)
    setEditText('')
  }

  const handleEditSave = async (id: string) => {
    if (!editText.trim() || !sessionUser?.id) return
    setIsSaving(true)
    try {
      const response = await fetch(apiUrl(`/api/memory/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editText.trim() }),
      })
      if (response.ok) {
        setEditingId(null)
        setEditText('')
        await loadMemory()
      } else {
        const payload = await response.json().catch(() => ({}))
        setError(payload.error || 'Failed to update memory.')
      }
    } catch {
      setError('Failed to update memory.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this memory note?')) return
    if (!sessionUser?.id) return

    try {
      const response = await fetch(apiUrl(`/api/memory/${id}`), {
        method: 'DELETE',
      })
      if (response.ok) {
        await loadMemory()
      } else {
        const payload = await response.json().catch(() => ({}))
        setError(payload.error || 'Failed to delete memory.')
      }
    } catch {
      setError('Failed to delete memory.')
    }
  }

  return (
    <main className="app-shell memory-shell">
      <div className="container">
        <header className="topbar memory-topbar">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              <RefreshCcw size={20} />
            </div>
            <div className="brand-copy">
              <h1>Memory</h1>
            </div>
          </div>
          <div className="toolbar-right">
            <Link href="/" className="button button-ghost">
              <X size={16} /> Back to chat
            </Link>
          </div>
        </header>

        <section className="panel memory-panel">
          <div className="memory-header">
            <div>
              <div className="section-title">Saved memories</div>
              <p className="section-subtitle">
                Bag-v1 keeps useful details you mention in chat. You can edit or delete any note below.
              </p>
            </div>
            <button
              className="button button-primary"
              type="button"
              onClick={handleAdd}
              disabled={!sessionUser || isLoading}
            >
              <Plus size={16} /> Add note
            </button>
          </div>

          {error ? <div className="error">{error}</div> : null}

          {isLoading ? (
            <div className="locked-panel">
              <LoaderCircle size={18} className="spin" />
              <p className="helper">Loading your memories…</p>
            </div>
          ) : items.length === 0 ? (
            <div className="locked-panel">
              <p className="helper">No saved memories yet. Chat a bit and we’ll keep useful notes here.</p>
            </div>
          ) : (
            <div className="memory-list">
              {items.map((item) => {
                const isEditing = editingId === item.id

                if (isEditing) {
                  return (
                    <div key={item.id} className="memory-item">
                      <div className="memory-edit-wrap">
                        <textarea
                          className="textarea"
                          value={editText}
                          onChange={(event) => setEditText(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault()
                              void handleEditSave(item.id)
                            }
                          }}
                          rows={3}
                          autoFocus
                        />
                        <div className="memory-edit-actions">
                          <button
                            type="button"
                            className="button button-ghost"
                            onClick={() => void handleEditSave(item.id)}
                            disabled={isSaving || !editText.trim()}
                          >
                            <Save size={14} /> Save
                          </button>
                          <button
                            type="button"
                            className="button button-ghost"
                            onClick={handleEditCancel}
                          >
                            <X size={14} /> Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={item.id} className="memory-item">
                    <div className="memory-text">{item.text}</div>
                    <div className="memory-meta">
                      <span className="memory-date">
                        {new Date(item.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => handleEditStart(item)}
                        aria-label="Edit memory"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => void handleDelete(item.id)}
                        aria-label="Delete memory"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {!sessionUser && (
          <section className="panel memory-panel">
            <div className="locked-panel">
              <p className="helper">Sign in to view and manage your memories.</p>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
