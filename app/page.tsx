'use client'
/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpRight,
  Copy,
  Download,
  Mic,
  MicOff,
  Paperclip,
  Play,
  RefreshCcw,
  Lock,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react'
import { APP_NAME, DEFAULT_MODEL, getModelOption, getModelOptions } from '@/lib/models'
import { apiUrl } from '@/lib/client-config'
import type { SessionUser } from '@/lib/auth'
import { GoogleSignInButton } from '@/components/google-sign-in-button'
import Image from 'next/image'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type UploadedFile = {
  id: string
  name: string
  type: string
  content: string
  size: number
}

type VoiceRecognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { results: Array<Array<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type WindowWithSpeech = Window & {
  SpeechRecognition?: new () => VoiceRecognition
  webkitSpeechRecognition?: new () => VoiceRecognition
}

const QUICK_PROMPTS = [
  'Summarize this app.',
  'Give me a Vercel launch checklist.',
  'Help me debug a route handler.',
  'Write a cleaner product blurb.',
]

const STORAGE_KEY = 'bag-v1-chat-state'
const CANVAS_STORAGE_KEY = 'bag-v1-canvas-state'
const IMAGE_STORAGE_KEY = 'bag-v1-image-state'
const VOICE_STORAGE_KEY = 'bag-v1-voice-state'
const USER_ID_KEY = 'bag-v1-user-id'
const MAX_ATTACHMENT_CHARS = 12000

function normalizeFilename(seed: string) {
  return seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'bag-v1'
}

export default function HomePage() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null)
  const [isSessionLoading, setIsSessionLoading] = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [userId, setUserId] = useState('')
  const [storageStatus, setStorageStatus] = useState<'loading' | 'local' | 'cloud'>('loading')
  const [isSending, setIsSending] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoice, setSelectedVoice] = useState('')
  const [speechRate, setSpeechRate] = useState(1.02)
  const [error, setError] = useState('')

  const [imagePrompt, setImagePrompt] = useState('A sleek futuristic AI assistant dashboard')
  const [imageUrl, setImageUrl] = useState('')
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [imageError, setImageError] = useState('')
  const [attachments, setAttachments] = useState<UploadedFile[]>([])
  const [canvasText, setCanvasText] = useState('')

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const recognitionRef = useRef<VoiceRecognition | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const currentModel = useMemo(() => getModelOption(model), [model])
  const modelOptions = useMemo(() => getModelOptions(), [])
  const canUseAdvancedTools = Boolean(sessionUser)
  const visibleModelOptions = useMemo(
    () => (canUseAdvancedTools ? modelOptions : [getModelOption(DEFAULT_MODEL)]),
    [canUseAdvancedTools, modelOptions],
  )

  useEffect(() => {
    if (visibleModelOptions.length === 0) {
      return
    }

    if (!visibleModelOptions.some((option) => option.id === model)) {
      setModel(visibleModelOptions[0]?.id ?? DEFAULT_MODEL)
    }
  }, [model, visibleModelOptions])

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      setIsSessionLoading(true)

      let resolvedSessionUser: SessionUser | null = null
      try {
        const response = await fetch(apiUrl('/api/auth/me'))
        if (response.ok) {
          const payload = (await response.json()) as { user: SessionUser | null }
          resolvedSessionUser = payload.user
          if (!cancelled) {
            setSessionUser(payload.user)
          }
        }
      } catch {
        resolvedSessionUser = null
      }

      const storedUserId = window.localStorage.getItem(USER_ID_KEY)
      const resolvedUserId = resolvedSessionUser?.id || storedUserId || crypto.randomUUID()
      if (!cancelled) {
        setUserId(resolvedUserId)
        setIsSessionLoading(false)
      }

      if (!resolvedSessionUser) {
        window.localStorage.setItem(USER_ID_KEY, resolvedUserId)
      }

      try {
        const stored = window.localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored) as { messages?: ChatMessage[]; model?: string }
          if (Array.isArray(parsed.messages) && !cancelled) {
            setMessages(parsed.messages)
          }
          if (parsed.model && !cancelled) {
            setModel(parsed.model)
          }
        }

        const storedImage = window.localStorage.getItem(IMAGE_STORAGE_KEY)
        if (storedImage) {
          const parsedImage = JSON.parse(storedImage) as { prompt?: string; imageUrl?: string }
          if (parsedImage.prompt && !cancelled) {
            setImagePrompt(parsedImage.prompt)
          }
          if (parsedImage.imageUrl && !cancelled) {
            setImageUrl(parsedImage.imageUrl)
          }
        }

        const storedCanvas = window.localStorage.getItem(CANVAS_STORAGE_KEY)
        if (storedCanvas && !cancelled) {
          setCanvasText(storedCanvas)
        }

        const storedVoice = window.localStorage.getItem(VOICE_STORAGE_KEY)
        if (storedVoice) {
          const parsedVoice = JSON.parse(storedVoice) as {
            voiceEnabled?: boolean
            selectedVoice?: string
            speechRate?: number
          }
          if (typeof parsedVoice.voiceEnabled === 'boolean' && !cancelled) {
            setVoiceEnabled(parsedVoice.voiceEnabled)
          }
          if (typeof parsedVoice.selectedVoice === 'string' && !cancelled) {
            setSelectedVoice(parsedVoice.selectedVoice)
          }
          if (typeof parsedVoice.speechRate === 'number' && !cancelled) {
            setSpeechRate(parsedVoice.speechRate)
          }
        }
      } catch {
        // Ignore storage errors and fall back to a clean session.
      }

      try {
        const response = await fetch(apiUrl(`/api/history?userId=${encodeURIComponent(resolvedUserId)}`))
        if (!response.ok) {
          if (!cancelled) {
            setStorageStatus('local')
          }
          return
        }

        const payload = (await response.json()) as {
          storageAvailable?: boolean
          entries?: Array<{ role: 'user' | 'assistant'; content: string }>
        }

        if (!cancelled) {
          setStorageStatus(payload.storageAvailable ? 'cloud' : 'local')
        }

        if (Array.isArray(payload.entries) && payload.entries.length > 0 && !cancelled) {
          setMessages(
            payload.entries.map((entry) => ({
              role: entry.role,
              content: entry.content,
            })),
          )
        }
      } catch {
        if (!cancelled) {
          setStorageStatus('local')
        }
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, model }))
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, model])

  useEffect(() => {
    window.localStorage.setItem(
      IMAGE_STORAGE_KEY,
      JSON.stringify({ prompt: imagePrompt, imageUrl }),
    )
  }, [imagePrompt, imageUrl])

  useEffect(() => {
    window.localStorage.setItem(
      VOICE_STORAGE_KEY,
      JSON.stringify({ voiceEnabled, selectedVoice, speechRate }),
    )
  }, [voiceEnabled, selectedVoice, speechRate])

  useEffect(() => {
    window.localStorage.setItem(CANVAS_STORAGE_KEY, canvasText)
  }, [canvasText])

  useEffect(() => {
    const refreshVoices = () => {
      const voices = window.speechSynthesis.getVoices()
      setAvailableVoices(voices)

      if (!selectedVoice && voices.length > 0) {
        const preferred = voices.find((voice) => voice.lang.toLowerCase().startsWith('en'))
        setSelectedVoice(preferred?.name ?? voices[0].name)
      }
    }

    refreshVoices()
    window.speechSynthesis.onvoiceschanged = refreshVoices

    return () => {
      window.speechSynthesis.onvoiceschanged = null
    }
  }, [selectedVoice])

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel()
    }
  }, [])

  const speak = (text: string) => {
    if (!voiceEnabled || !window.speechSynthesis) {
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = speechRate
    utterance.pitch = 1
    utterance.volume = 0.95
    const voice = availableVoices.find((item) => item.name === selectedVoice)
    if (voice) {
      utterance.voice = voice
    }
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }

  const startListening = () => {
    const speechWindow = window as WindowWithSpeech
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition

    if (!Recognition) {
      setError('Speech recognition is not supported in this browser.')
      return
    }

    const recognition = new Recognition()
    recognition.lang = 'en-US'
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join('')
      setInput(transcript.trim())
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    setError('')
    setIsListening(true)
    recognition.start()
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }

  const openFilePicker = () => {
    fileInputRef.current?.click()
  }

  const submitChat = async (nextMessage?: string) => {
    const messageText = (nextMessage ?? input).trim()
    if (!messageText || isSending) {
      return
    }

    const outboundAttachments = attachments
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: messageText }]
    setMessages(nextMessages)
    setInput('')
    setError('')
    setIsSending(true)

    try {
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          userId,
          userEmail: sessionUser?.email ?? '',
          messages: nextMessages,
          attachments: outboundAttachments,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(payload.error ?? 'Chat request failed.')
      }

      if (!response.body) {
        const payload = (await response.json().catch(() => ({}))) as { reply?: string }
        const reply = payload.reply ?? ''
        if (reply) {
          setMessages((current) => [...current, { role: 'assistant', content: reply }])
          setCanvasText(reply)
          speak(reply)
        }
        if (outboundAttachments.length > 0) {
          clearAttachments()
        }
        return
      }

      setMessages((current) => [...current, { role: 'assistant', content: '' }])

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }

        assistantText += decoder.decode(value, { stream: true })
        setMessages((current) =>
          current.map((message, index) => {
            if (index !== current.length - 1 || message.role !== 'assistant') {
              return message
            }

            return {
              ...message,
              content: assistantText,
            }
          }),
        )
      }

      assistantText += decoder.decode()
      const finalReply = assistantText.trim()
      setMessages((current) =>
        current.map((message, index) => {
          if (index !== current.length - 1 || message.role !== 'assistant') {
            return message
          }

          return {
            ...message,
            content: finalReply,
          }
        }),
      )

      if (finalReply) {
        setCanvasText(finalReply)
        speak(finalReply)
      }

      if (outboundAttachments.length > 0) {
        clearAttachments()
      }
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : 'Something went wrong.')
    } finally {
      setIsSending(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await submitChat()
  }

  const clearChat = () => {
    setMessages([])
    setInput('')
    setError('')
    window.localStorage.removeItem(STORAGE_KEY)
    window.speechSynthesis.cancel()
  }

  const copyTranscript = async () => {
    const transcript = messages
      .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
      .join('\n\n')

    await navigator.clipboard.writeText(transcript)
  }

  const handleAttachmentPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) {
      return
    }

    const nextAttachments: UploadedFile[] = []

    for (const file of files) {
      try {
        const content = await file.text()
        nextAttachments.push({
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type || 'text/plain',
          content: content.slice(0, MAX_ATTACHMENT_CHARS),
          size: file.size,
        })
      } catch {
        setError(`Unable to read ${file.name}.`)
      }
    }

    if (nextAttachments.length > 0) {
      setAttachments((current) => [...current, ...nextAttachments].slice(-8))
    }

    event.target.value = ''
  }

  const removeAttachment = (attachmentId: string) => {
    setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId))
  }

  const clearAttachments = () => {
    setAttachments([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const copyCanvas = async () => {
    await navigator.clipboard.writeText(canvasText || messages.at(-1)?.content || '')
  }

  const saveBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const downloadBlob = (content: string, filename: string, type: string) => {
    saveBlob(new Blob([content], { type }), filename)
  }

  const downloadTextFile = () => {
    const baseName = normalizeFilename(canvasText.split('\n')[0] ?? 'bag-v1')
    downloadBlob(canvasText || '', `${baseName}.txt`, 'text/plain;charset=utf-8')
  }

  const downloadPdfFile = async () => {
    const { jsPDF } = await import('jspdf')
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
    const margin = 42
    const width = pdf.internal.pageSize.getWidth() - margin * 2
    const lines = pdf.splitTextToSize(canvasText || '', width)
    let cursorY = margin

    pdf.setFont('times', 'normal')
    pdf.setFontSize(12)
    for (const line of lines as string[]) {
      if (cursorY > pdf.internal.pageSize.getHeight() - margin) {
        pdf.addPage()
        cursorY = margin
      }
      pdf.text(line, margin, cursorY)
      cursorY += 18
    }

    const baseName = normalizeFilename(canvasText.split('\n')[0] ?? 'bag-v1')
    pdf.save(`${baseName}.pdf`)
  }

  const downloadWordFile = async () => {
    const { Document, Packer, Paragraph, TextRun } = await import('docx')
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: (canvasText || '')
            .split('\n')
            .map((line) => new Paragraph({ children: [new TextRun(line || ' ')] })),
        },
      ],
    })

    const blob = await Packer.toBlob(doc)
    const baseName = normalizeFilename(canvasText.split('\n')[0] ?? 'bag-v1')
    saveBlob(blob, `${baseName}.docx`)
  }

  const generateImage = async () => {
    if (!canUseAdvancedTools) {
      setImageError('Sign in to use image generation.')
      return
    }

    const prompt = imagePrompt.trim()
    if (!prompt || isGeneratingImage) {
      return
    }

    setIsGeneratingImage(true)
    setImageError('')

    try {
      const response = await fetch(apiUrl('/api/image'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, userId, userEmail: sessionUser?.email ?? '' }),
      })

      const payload = (await response.json()) as
        | { imageUrl: string; model: string }
        | { error: string; details?: string }

      if (!response.ok) {
        throw new Error('error' in payload ? payload.error : 'Image generation failed.')
      }

      if ('imageUrl' in payload) {
        setImageUrl(payload.imageUrl)
      }
    } catch (imageGenError) {
      setImageError(
        imageGenError instanceof Error
          ? imageGenError.message
          : 'Unable to generate an image right now.',
      )
    } finally {
      setIsGeneratingImage(false)
    }
  }

  return (
    <main className="app-shell">
      <div className="container">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark brand-logo" aria-hidden="true">
              <Image src="/Bag-v1.png" alt="" width={42} height={42} priority />
            </div>
            <div className="brand-copy">
              <span className="eyebrow">Bag-v1</span>
              <h1>Ultra-modern assistant, tuned for Vercel.</h1>
              <p>Clean chat, locked premium tools, voice, uploads, and export-ready writing.</p>
            </div>
          </div>
          <div className="toolbar-right">
            {sessionUser ? (
              <button
                className="button button-ghost"
                type="button"
                onClick={async () => {
                  await fetch(apiUrl('/api/auth/logout'), { method: 'POST' })
                  window.localStorage.removeItem(USER_ID_KEY)
                  window.location.reload()
                }}
              >
                <RefreshCcw size={16} /> Sign out
              </button>
            ) : (
              <GoogleSignInButton
                className="auth-button-wrap"
                fullWidth={false}
                onSuccess={async (signedInUser) => {
                  setSessionUser(signedInUser)
                  setUserId(signedInUser.id)
                  window.localStorage.removeItem(USER_ID_KEY)
                  window.location.reload()
                }}
              />
            )}
            <button className="button button-ghost" type="button" onClick={copyTranscript} disabled={messages.length === 0}>
              <Copy size={16} /> Copy chat
            </button>
            <button className="button button-ghost" type="button" onClick={clearChat} disabled={messages.length === 0}>
              <RefreshCcw size={16} /> Clear
            </button>
          </div>
        </header>

        <section className="layout">
          <aside className="panel panel-hero">
            <div className="hero-card hero-main">
              <span className="eyebrow">Workspace</span>
              <h2>Focused by default. Powerful when signed in.</h2>
              <p>Guests stay on Llama 3.1 8B. Sign in to unlock the rest of the model roster and image generation.</p>
            </div>

            <div className="chip-row">
              <span className="chip-static">OpenRouter</span>
              <span className="chip-static">Google sign-in</span>
              <span className="chip-static">Canvas export</span>
              <span className="chip-static">File uploads</span>
            </div>

            <div className="mini-stats">
              <div className="mini-stat">
                <strong>{canUseAdvancedTools ? modelOptions.length : 1}</strong>
                <span>available models</span>
              </div>
              <div className="mini-stat">
                <strong>{storageStatus === 'cloud' ? 'Cloud' : 'Local'}</strong>
                <span>history mode</span>
              </div>
              <div className="mini-stat">
                <strong>{voiceEnabled ? 'On' : 'Off'}</strong>
                <span>voice output</span>
              </div>
            </div>

            <div className="hero-card">
              <span className="eyebrow">Tip</span>
              <p className="helper">Ask for a letter, code, report, or summary and the latest answer will land in the canvas so you can edit and export it fast.</p>
            </div>
          </aside>

          <div className="workspace-stack">
            <section className="panel chat-panel">
              <div className="chat-header">
                <div className="title-row">
                  <div>
                    <div className="section-title">Chat workspace</div>
                    <p className="section-subtitle">
                      Current model: <strong>{currentModel.label}</strong>
                    </p>
                  </div>
                  <div className="user-chip">
                    <span>{sessionUser?.email ?? (isSessionLoading ? 'Loading session...' : 'Guest mode')}</span>
                  </div>
                </div>

                <div className="toolbar">
                  <div className="toolbar-left">
                    <button
                      className="button button-ghost"
                      type="button"
                      onClick={() => speak(messages.at(-1)?.content ?? 'Voice is ready.')}
                      disabled={!voiceEnabled || messages.length === 0}
                    >
                      <Volume2 size={16} /> Read last reply
                    </button>
                  </div>
                  <div className="toolbar-right">
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={voiceEnabled}
                        onChange={(event) => setVoiceEnabled(event.target.checked)}
                      />
                      Voice output
                    </label>
                    <select
                      className="control"
                      value={selectedVoice}
                      onChange={(event) => setSelectedVoice(event.target.value)}
                      aria-label="Select voice"
                      disabled={availableVoices.length === 0}
                    >
                      {availableVoices.length === 0 ? (
                        <option value="">Loading voices...</option>
                      ) : (
                        availableVoices.map((voice) => (
                          <option key={voice.name} value={voice.name}>
                            {voice.name} ({voice.lang})
                          </option>
                        ))
                      )}
                    </select>
                    <label className="toggle" title="Speech speed">
                      Speed
                      <input
                        type="range"
                        min="0.8"
                        max="1.3"
                        step="0.02"
                        value={speechRate}
                        onChange={(event) => setSpeechRate(Number(event.target.value))}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="section-heading-row">
                <div>
                  <div className="section-title">Models</div>
                  <p className="section-subtitle">
                    {canUseAdvancedTools
                      ? 'Signed-in users can switch models.'
                      : 'Guests are locked to Llama 3.1 8B until they sign in.'}
                  </p>
                </div>
                <div className="status-pill">{canUseAdvancedTools ? `${modelOptions.length} models` : 'Locked'}</div>
              </div>

              {canUseAdvancedTools ? (
                <section className="model-picker">
                  {visibleModelOptions.map((option) => {
                    const active = option.id === model
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`model-card ${active ? 'active' : ''}`}
                        onClick={() => setModel(option.id)}
                        aria-pressed={active}
                      >
                        <span className="model-name">{option.label}</span>
                        <span className="model-desc">{option.bestFor}</span>
                        <span className="model-meta">{option.description}</span>
                      </button>
                    )
                  })}
                </section>
              ) : (
                <section className="model-picker locked-model">
                  <div className="model-card locked-card active">
                    <span className="model-name">Llama 3.1 8B</span>
                    <span className="model-desc">Default guest model</span>
                    <span className="model-meta">Sign in to unlock the full model list and image generation.</span>
                    <div className="locked-badge">
                      <Lock size={14} /> Locked
                    </div>
                    <GoogleSignInButton className="auth-button-wrap" fullWidth onSuccess={async (signedInUser) => {
                      setSessionUser(signedInUser)
                      setUserId(signedInUser.id)
                      window.localStorage.removeItem(USER_ID_KEY)
                      window.location.reload()
                    }} />
                  </div>
                </section>
              )}

              <div className="messages">
                {messages.length === 0 ? (
                  <div className="empty-state">
                    <h2>Start a conversation</h2>
                    <p>Type a prompt, attach a file, or tap a quick starter.</p>
                  </div>
                ) : null}

                {messages.map((message, index) => (
                  <article key={`${message.role}-${index}`} className={`message ${message.role}`}>
                    <div className="message-meta">{message.role === 'user' ? 'You' : APP_NAME}</div>
                    <div className="bubble">{message.content}</div>
                  </article>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <form className="composer" onSubmit={handleSubmit}>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="sr-only"
                  multiple
                  onChange={handleAttachmentPick}
                />

                {attachments.length > 0 ? (
                  <div className="attachment-strip">
                    {attachments.map((attachment) => (
                      <span key={attachment.id} className="attachment-chip">
                        <span>
                          <strong>{attachment.name}</strong>
                          <small>{attachment.type || 'file'}</small>
                        </span>
                        <button type="button" onClick={() => removeAttachment(attachment.id)} aria-label={`Remove ${attachment.name}`}>
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="composer-row">
                  <textarea
                    className="textarea"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Ask Bag-v1 anything..."
                    rows={5}
                  />
                  <button className="button button-primary" type="submit" disabled={isSending || input.trim().length === 0}>
                    <ArrowUpRight size={16} /> {isSending ? 'Sending...' : 'Send'}
                  </button>
                </div>

                <div className="composer-actions">
                  <div className="switches">
                    <button className="button button-ghost" type="button" onClick={openFilePicker}>
                      <Paperclip size={16} /> Upload file
                    </button>
                    <button className="button button-ghost" type="button" onClick={startListening} disabled={isListening}>
                      <Mic size={16} /> {isListening ? 'Listening...' : 'Dictate'}
                    </button>
                    <button className="button button-ghost" type="button" onClick={stopListening} disabled={!isListening}>
                      <MicOff size={16} /> Stop listening
                    </button>
                    <button
                      className="button button-ghost"
                      type="button"
                      onClick={() => window.speechSynthesis.cancel()}
                      disabled={!isSpeaking}
                    >
                      <Play size={16} /> Stop voice
                    </button>
                  </div>
                  <p className="helper">{error || 'Type, dictate, upload, or use voice output.'}</p>
                </div>

                <div className="quick-prompts">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      className="chip"
                      type="button"
                      onClick={() => submitChat(prompt)}
                      disabled={isSending}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </form>
            </section>

            <section className="panel canvas-panel">
              <div className="section-heading-row">
                <div>
                  <div className="section-title">Canvas</div>
                  <p className="section-subtitle">Edit here, then copy or export as text, Word, or PDF.</p>
                </div>
                <div className="status-pill">Editable draft</div>
              </div>

              <textarea
                className="textarea canvas-textarea"
                value={canvasText}
                onChange={(event) => setCanvasText(event.target.value)}
                placeholder="The latest assistant reply will appear here. Edit it freely for letters, code, and documents."
                rows={12}
              />

              <div className="canvas-actions">
                <button className="button button-ghost" type="button" onClick={copyCanvas} disabled={!canvasText.trim()}>
                  <Copy size={16} /> Copy canvas
                </button>
                <button className="button button-ghost" type="button" onClick={downloadTextFile} disabled={!canvasText.trim()}>
                  <Download size={16} /> TXT
                </button>
                <button className="button button-ghost" type="button" onClick={downloadPdfFile} disabled={!canvasText.trim()}>
                  <Download size={16} /> PDF
                </button>
                <button className="button button-ghost" type="button" onClick={downloadWordFile} disabled={!canvasText.trim()}>
                  <Download size={16} /> Word
                </button>
                <button className="button button-danger" type="button" onClick={() => setCanvasText('')} disabled={!canvasText.trim()}>
                  <RefreshCcw size={16} /> Clear canvas
                </button>
              </div>

              <p className="helper">When the assistant finishes a reply, Bag-v1 drops it here automatically so you can polish and export it.</p>
            </section>

            <section className="panel image-panel">
              <div className="section-heading-row">
                <div>
                  <div className="section-title">Image generation</div>
                  <p className="section-subtitle">
                    {canUseAdvancedTools
                      ? 'Prompt an image, then preview the result below.'
                      : 'Sign in to unlock image generation.'}
                  </p>
                </div>
                <div className="status-pill">{canUseAdvancedTools ? 'OpenRouter' : 'Locked'}</div>
              </div>

              {canUseAdvancedTools ? (
                <>
                  <div className="composer-row">
                    <textarea
                      className="textarea"
                      value={imagePrompt}
                      onChange={(event) => setImagePrompt(event.target.value)}
                      placeholder="Describe the image you want..."
                      rows={3}
                    />
                    <button className="button button-primary" type="button" onClick={generateImage} disabled={isGeneratingImage}>
                      <Sparkles size={16} /> {isGeneratingImage ? 'Generating...' : 'Generate'}
                    </button>
                  </div>

                  {imageError ? <div className="error">{imageError}</div> : null}

                  <div className="image-preview">
                    {imageUrl ? (
                      <img src={imageUrl} alt="Generated result" />
                    ) : (
                      <div className="placeholder">
                        <strong>No image yet.</strong>
                        <div className="meta">Generate one to preview the OpenRouter image flow.</div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="locked-panel">
                  <div className="hero-card">
                    <span className="eyebrow">Premium tool</span>
                    <h3>Sign in to generate images.</h3>
                    <p>The image model stays hidden until you sign in. That keeps the guest UI clean and locked to the default chat model.</p>
                    <GoogleSignInButton className="auth-button-wrap" fullWidth onSuccess={async (signedInUser) => {
                      setSessionUser(signedInUser)
                      setUserId(signedInUser.id)
                      window.localStorage.removeItem(USER_ID_KEY)
                      window.location.reload()
                    }} />
                  </div>
                </div>
              )}
            </section>
          </div>
        </section>

        <p className="footer-note">
          OpenRouter chat, canvas export, file uploads, and image generation all run from the same Vercel app. Set `OPENROUTER_API_KEY` before you use the routes.
        </p>
      </div>
    </main>
  )
}
