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
import { UserButton, useUser } from '@clerk/nextjs'
import Link from 'next/link'
import type { Route } from 'next'
import { APP_NAME, DEFAULT_MODEL, MODEL_OPTIONS, getModelOption } from '@/lib/models'

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
  'Explain this app in one paragraph.',
  'Give me a deployment checklist for Vercel.',
  'Write a short product summary for this assistant.',
  'Help me debug a Next.js route handler.',
]

const STORAGE_KEY = 'bag-v1-chat-state'
const IMAGE_STORAGE_KEY = 'bag-v1-image-state'
const VOICE_STORAGE_KEY = 'bag-v1-voice-state'
const USER_ID_KEY = 'bag-v1-user-id'

export default function HomePage() {
  const { user, isLoaded } = useUser()
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

  useEffect(() => {
    const storedUserId = window.localStorage.getItem(USER_ID_KEY)
    const clerkUserId = user?.id ?? ''
    const resolvedUserId = clerkUserId || storedUserId || crypto.randomUUID()
    setUserId(resolvedUserId)
    if (!clerkUserId) {
      window.localStorage.setItem(USER_ID_KEY, resolvedUserId)
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as { messages?: ChatMessage[]; model?: string }
        if (Array.isArray(parsed.messages)) {
          setMessages(parsed.messages)
        }
        if (parsed.model) {
          setModel(parsed.model)
        }
      }

      const storedImage = window.localStorage.getItem(IMAGE_STORAGE_KEY)
      if (storedImage) {
        const parsedImage = JSON.parse(storedImage) as { prompt?: string; imageUrl?: string }
        if (parsedImage.prompt) {
          setImagePrompt(parsedImage.prompt)
        }
        if (parsedImage.imageUrl) {
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
        if (typeof parsedVoice.voiceEnabled === 'boolean') {
          setVoiceEnabled(parsedVoice.voiceEnabled)
        }
        if (typeof parsedVoice.selectedVoice === 'string') {
          setSelectedVoice(parsedVoice.selectedVoice)
        }
        if (typeof parsedVoice.speechRate === 'number') {
          setSpeechRate(parsedVoice.speechRate)
        }
      }
    } catch {
      // Ignore storage errors and fall back to a clean session.
    }

    void (async () => {
      try {
        const response = await fetch(`/api/history?userId=${encodeURIComponent(resolvedUserId)}`)
        if (!response.ok) {
          setStorageStatus('local')
          return
        }

        const payload = (await response.json()) as {
          storageAvailable?: boolean
          entries?: Array<{ role: 'user' | 'assistant'; content: string }>
        }

        if (payload.storageAvailable) {
          setStorageStatus('cloud')
        } else {
          setStorageStatus('local')
        }

        if (Array.isArray(payload.entries) && payload.entries.length > 0) {
          setMessages(
            payload.entries.map((entry) => ({
              role: entry.role,
              content: entry.content,
            })),
          )
        }
      } catch {
        setStorageStatus('local')
      }
    })()
  }, [user?.id])

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
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          userId,
          userEmail: user?.primaryEmailAddress?.emailAddress ?? '',
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
      const response = await fetch('/api/image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, userId, userEmail: user?.primaryEmailAddress?.emailAddress ?? '' }),
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
              <span className="eyebrow">Vercel-ready rewrite</span>
              <h1>Bag-v1, now on Next.js and TypeScript</h1>
              <p>Same assistant idea, but in a stack that fits Vercel natively.</p>
            </div>
          </div>
          <div className="toolbar-right">
            {user ? (
              <UserButton />
            ) : (
              <>
                <Link className="button button-ghost" href={'/sign-in' as Route}>
                  Sign in
                </Link>
                <Link className="button button-ghost" href={'/sign-up' as Route}>
                  Sign up
                </Link>
              </>
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
            <div className="hero-card">
              <span className="eyebrow">What changed</span>
              <h2>Python Flask is out. Next.js App Router is in.</h2>
              <p>
                The backend now runs as a Vercel route handler, the UI is React + TypeScript,
                and voice features use browser APIs instead of server-side desktop libraries.
              </p>
            </div>

            <ul className="feature-list">
              <li><span className="feature-dot" /> Chat endpoint powered by OpenRouter from a Vercel-compatible API route.</li>
              <li><span className="feature-dot" /> Browser speech recognition plus free selectable browser voices for hands-free interaction.</li>
              <li><span className="feature-dot" /> Image generation endpoint preserved with the same OpenRouter backend.</li>
              <li><span className="feature-dot" /> Local chat and image state persisted in browser storage.</li>
            </ul>

            <div className="stats">
              <div className="stat">
                <strong>TypeScript</strong>
                <span>Single language across app and API</span>
              </div>
              <div className="stat">
                <strong>Vercel</strong>
                <span>Zero-config deploy path</span>
              </div>
              <div className="stat">
                <strong>{MODEL_OPTIONS.length} models</strong>
                <span>Curated defaults from the old app</span>
              </div>
              <div className="stat">
                <strong>Browser voice</strong>
                <span>No Python audio dependency</span>
              </div>
              <div className="stat">
                <strong>Storage</strong>
                <span>{storageStatus === 'cloud' ? 'Cloud history enabled' : 'Local fallback active'}</span>
              </div>
            </div>
          </aside>

          <section className="panel chat-panel">
            <div className="chat-header">
              <div className="section-title">Chat workspace</div>
              <p className="section-subtitle">
                Current model: <strong>{currentModel.label}</strong>
              </p>
              <p className="meta-row">
                User ID: <code>{userId || 'loading...'}</code>
                {isLoaded && user?.primaryEmailAddress?.emailAddress ? (
                  <> | Gmail: <code>{user.primaryEmailAddress.emailAddress}</code></>
                ) : null}
              </p>

              <div className="toolbar">
                <div className="toolbar-left">
                  <select
                    className="control"
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    aria-label="Select model"
                  >
                    {MODEL_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
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

            <div className="messages">
              {messages.length === 0 ? (
                <div className="hero-card">
                  <h2>Start the conversation</h2>
                  <p>
                    Ask something about the migration, test the Vercel setup, or send a quick
                    prompt from the chips below.
                  </p>
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
                <p className="helper">{error || 'Type a prompt, dictate it, or let the assistant read replies aloud.'}</p>
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
          <div>
            <div className="section-title">Image generation</div>
            <p className="section-subtitle">
              Keep the visual feature from the original app and run it from the same OpenRouter key.
            </p>
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
          Built as a clean Next.js + TypeScript base for Vercel. Set `OPENROUTER_API_KEY` in your environment before running the chat or image routes.
        </p>
      </div>
    </main>
  )
}
