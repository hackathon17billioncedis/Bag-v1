'use client'
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpRight,
  Copy,
  ExternalLink,
  Mic,
  MicOff,
  Play,
  RefreshCcw,
  Sparkles,
  Volume2,
} from 'lucide-react'
import Link from 'next/link'
import { APP_NAME, DEFAULT_MODEL, getModelOption, getModelOptions } from '@/lib/models'
import { apiUrl } from '@/lib/client-config'
import type { SessionUser } from '@/lib/auth'
import { GoogleSignInButton } from '@/components/google-sign-in-button'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
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
const IMAGE_STORAGE_KEY = 'bag-v1-image-state'
const VOICE_STORAGE_KEY = 'bag-v1-voice-state'
const USER_ID_KEY = 'bag-v1-user-id'

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

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const recognitionRef = useRef<VoiceRecognition | null>(null)

  const currentModel = useMemo(() => getModelOption(model), [model])
  const modelOptions = useMemo(() => getModelOptions(), [])

  useEffect(() => {
    if (modelOptions.length === 0) {
      return
    }

    if (!modelOptions.some((option) => option.id === model)) {
      setModel(modelOptions[0]?.id ?? DEFAULT_MODEL)
    }
  }, [model, modelOptions])

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

  const submitChat = async (nextMessage?: string) => {
    const messageText = (nextMessage ?? input).trim()
    if (!messageText || isSending) {
      return
    }

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
          speak(reply)
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
        speak(finalReply)
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

  const generateImage = async () => {
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
            <div className="brand-mark" aria-hidden="true">
              <Sparkles />
            </div>
          <div className="brand-copy">
              <span className="eyebrow">Bag-v1</span>
              <h1>Ultra-clean AI workspace for Vercel.</h1>
              <p>Chat, switch models, use voice, and keep everything simple.</p>
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
            <Link className="button button-ghost" href="/admin">
              <ExternalLink size={16} /> Admin
            </Link>
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
              <span className="eyebrow">Bag-v1</span>
              <h2>Fast, polished, and built to ship.</h2>
              <p>Pick a model, send a prompt, and keep the whole experience focused.</p>
            </div>

            <div className="chip-row">
              <span className="chip-static">OpenRouter</span>
              <span className="chip-static">Google sign-in</span>
              <span className="chip-static">Browser voice</span>
            </div>

            <div className="mini-stats">
              <div className="mini-stat">
                <strong>{modelOptions.length}</strong>
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
          </aside>

          <section className="panel chat-panel">
            <div className="chat-header">
              <div className="title-row">
                <div>
                  <div className="section-title">Chat workspace</div>
                  <p className="section-subtitle">Current model: <strong>{currentModel.label}</strong></p>
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
                <p className="section-subtitle">Visible roster. Tap one to switch instantly.</p>
              </div>
              <div className="status-pill">{modelOptions.length} models</div>
            </div>

            <section className="model-picker">
              {modelOptions.map((option) => {
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

            <div className="messages">
              {messages.length === 0 ? (
                <div className="empty-state">
                  <h2>Start a conversation</h2>
                  <p>Type a prompt or tap one of the quick starters.</p>
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
              <div className="composer-row">
                <textarea
                  className="textarea"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask Bag-v1 anything..."
                  rows={4}
                />
                <button className="button button-primary" type="submit" disabled={isSending || input.trim().length === 0}>
                  <ArrowUpRight size={16} /> {isSending ? 'Sending...' : 'Send'}
                </button>
              </div>

              <div className="composer-actions">
                <div className="switches">
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
                <p className="helper">{error || 'Type, dictate, or use voice output.'}</p>
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
        </section>

        <section className="panel image-panel">
          <div className="section-heading-row">
            <div>
              <div className="section-title">Image generation</div>
              <p className="section-subtitle">Prompt an image, then preview the result below.</p>
            </div>
            <div className="status-pill">OpenRouter</div>
          </div>

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
        </section>

        <p className="footer-note">
          OpenRouter chat and image generation run from the same Vercel app. Set `OPENROUTER_API_KEY` before you use either route.
        </p>
      </div>
    </main>
  )
}
