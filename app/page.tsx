'use client'
/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, FormEvent, KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Copy,
  Download,
  LoaderCircle,
  Lock,
  Mic,
  MicOff,
  Paperclip,
  Plus,
  Menu,
  RefreshCcw,
  Search,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Video,
  Volume2,
  X,
} from 'lucide-react'
import Image from 'next/image'
import { EmailOTPAuth } from '@/components/email-otp-auth'
import { apiUrl } from '@/lib/client-config'
import type { SessionUser } from '@/lib/auth'
import { APP_NAME, DEFAULT_IMAGE_MODEL, DEFAULT_MODEL, DEFAULT_TTS_MODEL, DEFAULT_VIDEO_MODEL, getModelOption, getModelOptions, IMAGE_MODEL_OPTIONS, TTS_MODEL_OPTIONS, VIDEO_MODEL_OPTIONS, type ModelOption } from '@/lib/models'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type ConversationThread = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
  lastMessageAt: string | null
  lastMessagePreview: string | null
  lastModel: string | null
}

type MemoryItem = {
  id: string
  text: string
  createdAt: string
  sourceChatId: string
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
  'Draft a proposal',
  'Explain this file',
  'Write production code',
  'Summarize notes',
]

const MAX_ATTACHMENT_CHARS = 12000

function normalizeFilename(seed: string) {
  return seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'bag-v1'
}

function formatAssistantDisplayText(text: string) {
  const normalized = text.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  let inCodeBlock = false

  const formatted = lines
    .map((line) => {
      const trimmed = line.trim()

      if (trimmed.startsWith('```')) {
        inCodeBlock = !inCodeBlock
        return ''
      }

      if (inCodeBlock) {
        return line
      }

      const bulletMatch = trimmed.match(/^[*+-]\s+(.*)$/)
      if (bulletMatch) {
        return `• ${bulletMatch[1].replace(/[`*_]/g, '')}`
      }

      const numberedMatch = trimmed.match(/^\d+\.\s+(.*)$/)
      if (numberedMatch) {
        return `• ${numberedMatch[1].replace(/[`*_]/g, '')}`
      }

      return line
        .replace(/^#{1,6}\s+/, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/__(.*?)__/g, '$1')
        .replace(/[*_`]/g, '')
    })
    .join('\n')

  return formatted.replace(/\n{3,}/g, '\n\n').trim()
}

export default function HomePage() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null)
  const [isSessionLoading, setIsSessionLoading] = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [userId, setUserId] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [error, setError] = useState('')
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [isAuthMenuOpen, setIsAuthMenuOpen] = useState(false)
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false)
  const [isToolMenuOpen, setIsToolMenuOpen] = useState(false)
  const [activeToolPanel, setActiveToolPanel] = useState<'canvas' | 'image' | 'video' | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [chatId, setChatId] = useState('')
  const [threads, setThreads] = useState<ConversationThread[]>([])
  const [memory, setMemory] = useState<MemoryItem[]>([])
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(true)

  const [imagePrompt, setImagePrompt] = useState('A sleek futuristic AI assistant dashboard')
  const [imageModel, setImageModel] = useState(DEFAULT_IMAGE_MODEL)
  const [imageUrl, setImageUrl] = useState('')
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [imageError, setImageError] = useState('')
  const [ttsModel, setTtsModel] = useState(DEFAULT_TTS_MODEL)
  const [videoPrompt, setVideoPrompt] = useState('')
  const [videoModel, setVideoModel] = useState(DEFAULT_VIDEO_MODEL)
  const [videoUrl, setVideoUrl] = useState('')
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const [videoError, setVideoError] = useState('')
  const [attachments, setAttachments] = useState<UploadedFile[]>([])
  const [canvasText, setCanvasText] = useState('')
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in')

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const lastMessageCountRef = useRef(0)
  const recognitionRef = useRef<VoiceRecognition | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const canvasRef = useRef<HTMLTextAreaElement | null>(null)
  const imageRef = useRef<HTMLTextAreaElement | null>(null)

  const currentModel = useMemo(() => getModelOption(model), [model])
  const modelOptions = useMemo(() => getModelOptions(), [])
  const canUseAdvancedTools = Boolean(sessionUser)
  const visibleModelOptions = useMemo(
    () => (canUseAdvancedTools ? modelOptions : [getModelOption(DEFAULT_MODEL)]),
    [canUseAdvancedTools, modelOptions],
  )
  const groupedModelOptions = useMemo(() => {
    const groups = new Map<string, ModelOption[]>()

    for (const option of visibleModelOptions) {
      const list = groups.get(option.category) ?? []
      list.push(option)
      groups.set(option.category, list)
    }

    return Array.from(groups.entries()).map(([category, options]) => ({ category, options }))
  }, [visibleModelOptions])

  const syncWorkspace = async (nextChatId?: string, nextMessage?: ChatMessage[]) => {
    if (!sessionUser?.id) {
      return
    }

    try {
      const response = await fetch(apiUrl('/api/conversations'))
      if (!response.ok) {
        return
      }

      const payload = (await response.json()) as {
        threads?: ConversationThread[]
        memory?: MemoryItem[]
        activeChatId?: string
      }

      if (Array.isArray(payload.threads)) {
        setThreads(payload.threads)
      }

      if (Array.isArray(payload.memory)) {
        setMemory(payload.memory)
      }

      const resolvedChatId = nextChatId ?? payload.activeChatId ?? chatId
      if (resolvedChatId) {
        setChatId(resolvedChatId)
        window.localStorage.setItem(`bag-v1:active-chat:${sessionUser.id}`, resolvedChatId)
      }

      if (Array.isArray(nextMessage) && nextMessage.length > 0) {
        setMessages(nextMessage)
      }
    } catch {
      // Ignore sidebar refresh issues.
    }
  }

  const loadConversation = async (conversationId: string) => {
    if (!sessionUser?.id) {
      return
    }

    setChatId(conversationId)
    setActiveToolPanel(null)
    setError('')

    try {
      const response = await fetch(apiUrl(`/api/history?chatId=${encodeURIComponent(conversationId)}`))
      if (!response.ok) {
        return
      }

      const payload = (await response.json()) as {
        entries?: Array<{ role: 'user' | 'assistant'; content: string }>
      }

      const entries = Array.isArray(payload.entries)
        ? payload.entries.map((entry) => ({
            role: entry.role,
            content: entry.content,
          }))
        : []

      setMessages(entries)
      setCanvasText(entries.filter((entry) => entry.role === 'assistant').at(-1)?.content ?? '')
      window.localStorage.setItem(`bag-v1:active-chat:${sessionUser.id}`, conversationId)
    } catch {
      // Ignore load errors.
    }
  }

  const startNewConversation = async () => {
    setMessages([])
    setInput('')
    setError('')
    setCanvasText('')
    setImageUrl('')
    setImageError('')
    setVideoUrl('')
    setVideoPrompt('')
    setVideoError('')
    setActiveToolPanel(null)

    if (!sessionUser?.id) {
      const nextId = crypto.randomUUID()
      setChatId(nextId)
      return
    }

    try {
      const response = await fetch(apiUrl('/api/conversations'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: crypto.randomUUID(),
          title: 'New chat',
          model,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create a new chat.')
      }

      const payload = (await response.json()) as { thread?: ConversationThread }
      const nextId = payload.thread?.id ?? crypto.randomUUID()
      setChatId(nextId)
      await syncWorkspace(nextId, [])
      await loadConversation(nextId)
    } catch (newChatError) {
      setError(newChatError instanceof Error ? newChatError.message : 'Failed to create a new chat.')
    }
  }

  useEffect(() => {
    if (!visibleModelOptions.some((option) => option.id === model)) {
      setModel(visibleModelOptions[0]?.id ?? DEFAULT_MODEL)
    }
  }, [model, visibleModelOptions])

  useEffect(() => {
    if (!isModelMenuOpen && !isToolMenuOpen && !isAuthMenuOpen) {
      return
    }

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsModelMenuOpen(false)
        setIsToolMenuOpen(false)
        setIsAuthMenuOpen(false)
        setActiveToolPanel(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isAuthMenuOpen, isModelMenuOpen, isToolMenuOpen])

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      setIsSessionLoading(true)
      setIsWorkspaceLoading(true)

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
        if (!cancelled) {
          setSessionUser(null)
        }
      }

      const resolvedUserId = resolvedSessionUser?.id || crypto.randomUUID()
      const nextChatId = resolvedSessionUser
        ? window.localStorage.getItem(`bag-v1:active-chat:${resolvedUserId}`) || crypto.randomUUID()
        : crypto.randomUUID()

      if (!cancelled) {
        setUserId(resolvedUserId)
        setChatId(nextChatId)
        setIsSessionLoading(false)
      }

      if (!resolvedSessionUser) {
        if (!cancelled) {
          setMessages([])
          setThreads([])
          setMemory([])
          setInput('')
          setWebSearchEnabled(false)
          setModel(DEFAULT_MODEL)
          setImagePrompt('A sleek futuristic AI assistant dashboard')
          setImageUrl('')
          setCanvasText('')
          setActiveToolPanel(null)
          setIsWorkspaceLoading(false)
        }
        return
      }

      try {
        const response = await fetch(apiUrl('/api/conversations'))
        if (response.ok) {
          const payload = (await response.json()) as {
            threads?: ConversationThread[]
            memory?: MemoryItem[]
            activeChatId?: string
          }

          const availableThreads = Array.isArray(payload.threads) ? payload.threads : []
          const availableMemory = Array.isArray(payload.memory) ? payload.memory : []
          const resolvedThreadId =
            availableThreads.some((thread) => thread.id === nextChatId)
              ? nextChatId
              : payload.activeChatId || availableThreads[0]?.id || nextChatId

          if (!cancelled) {
            setThreads(availableThreads)
            setMemory(availableMemory)
            setChatId(resolvedThreadId)
            window.localStorage.setItem(`bag-v1:active-chat:${resolvedUserId}`, resolvedThreadId)
          }

          if (availableThreads.length === 0) {
            const createResponse = await fetch(apiUrl('/api/conversations'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                chatId: resolvedThreadId,
                title: 'New chat',
                model: DEFAULT_MODEL,
              }),
            })

            if (createResponse.ok) {
              const createPayload = (await createResponse.json()) as { thread?: ConversationThread }
              if (createPayload.thread && !cancelled) {
                setThreads([createPayload.thread])
                setChatId(createPayload.thread.id)
                window.localStorage.setItem(
                  `bag-v1:active-chat:${resolvedUserId}`,
                  createPayload.thread.id,
                )
              }
            }
          }

          const historyResponse = await fetch(
            apiUrl(`/api/history?chatId=${encodeURIComponent(resolvedThreadId)}`),
          )
          if (historyResponse.ok) {
            const historyPayload = (await historyResponse.json()) as {
              entries?: Array<{ role: 'user' | 'assistant'; content: string }>
            }

            if (!cancelled) {
              const entries = Array.isArray(historyPayload.entries)
                ? historyPayload.entries.map((entry) => ({
                    role: entry.role,
                    content: entry.content,
                  }))
                : []

              setMessages(entries)
              setCanvasText(entries.filter((entry) => entry.role === 'assistant').at(-1)?.content ?? '')
            }
          }
        }
      } catch {
        // Ignore workspace errors.
      } finally {
        if (!cancelled) {
          setIsWorkspaceLoading(false)
        }
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const previousCount = lastMessageCountRef.current
    const nextCount = messages.length
    lastMessageCountRef.current = nextCount

    if (nextCount <= previousCount) {
      return
    }

    messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end', inline: 'nearest' })
  }, [messages])

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel()
    }
  }, [])

  const speak = async (text: string) => {
    if (!text.trim() || isSpeaking) {
      return
    }

    setIsSpeaking(true)
    try {
      const response = await fetch(apiUrl('/api/tts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model: ttsModel }),
      })
      if (!response.ok) {
        throw new Error('TTS request failed')
      }
      const blob = await response.blob()
      const audio = new Audio(URL.createObjectURL(blob))
      audio.onended = () => setIsSpeaking(false)
      audio.onerror = () => setIsSpeaking(false)
      await audio.play()
    } catch {
      setIsSpeaking(false)
    }
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
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    setError('')
    setIsListening(true)
    recognition.start()
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setIsListening(false)
  }

  const toggleListening = () => {
    if (isListening) {
      stopListening()
      return
    }

    startListening()
  }

  const openFilePicker = () => {
    fileInputRef.current?.click()
  }

  const submitChat = async (nextMessage?: string) => {
    const messageText = (nextMessage ?? input).trim()
    if (!messageText || isSending) {
      return
    }

    const activeChatId = chatId || crypto.randomUUID()
    if (!chatId) {
      setChatId(activeChatId)
    }

    const outboundAttachments = attachments
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: messageText }]
    setMessages(nextMessages)
    setInput('')
    setError('')
    setIsSending(true)
    setIsThinking(true)

    try {
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          webSearchEnabled: canUseAdvancedTools && webSearchEnabled,
          userId,
          userEmail: sessionUser?.email ?? '',
          chatId: activeChatId,
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
        setIsThinking(false)
        if (reply) {
          setMessages((current) => [...current, { role: 'assistant', content: reply }])
          setCanvasText(reply)
        }
        if (outboundAttachments.length > 0) {
          clearAttachments()
        }
        if (sessionUser?.id) {
          void syncWorkspace(activeChatId)
        }
        return
      }

      setMessages((current) => [...current, { role: 'assistant', content: '' }])

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''
      let hasFirstChunk = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }

        assistantText += decoder.decode(value, { stream: true })
        if (!hasFirstChunk) {
          hasFirstChunk = true
          setIsThinking(false)
        }

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
      setIsThinking(false)

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
      }

      if (outboundAttachments.length > 0) {
        clearAttachments()
      }

      if (sessionUser?.id) {
        void syncWorkspace(activeChatId)
      }
    } catch (chatError) {
      setIsThinking(false)
      setError(chatError instanceof Error ? chatError.message : 'Something went wrong.')
    } finally {
      setIsThinking(false)
      setIsSending(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await submitChat()
  }

  const handleComposerKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) {
      return
    }

    event.preventDefault()
    void submitChat()
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

  const copyMessage = async (content: string) => {
    await navigator.clipboard.writeText(content)
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
        body: JSON.stringify({ prompt, model: imageModel, userId, userEmail: sessionUser?.email ?? '' }),
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

  const generateVideo = async () => {
    if (!canUseAdvancedTools) {
      setVideoError('Sign in to use video generation.')
      return
    }

    const prompt = videoPrompt.trim()
    if (!prompt || isGeneratingVideo) {
      return
    }

    setIsGeneratingVideo(true)
    setVideoError('')

    try {
      const response = await fetch(apiUrl('/api/video'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, model: videoModel }),
      })

      const payload = (await response.json()) as
        | { result: string; model: string }
        | { error: string; details?: string }

      if (!response.ok) {
        throw new Error('error' in payload ? payload.error : 'Video generation failed.')
      }

      if ('result' in payload) {
        setVideoUrl(payload.result)
      }
    } catch (videoGenError) {
      setVideoError(
        videoGenError instanceof Error
          ? videoGenError.message
          : 'Unable to generate a video right now.',
      )
    } finally {
      setIsGeneratingVideo(false)
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
              <h1>BAG-V1</h1>
            </div>
            {sessionUser ? (
              <button
                className="icon-button sidebar-toggle"
                type="button"
                onClick={() => setIsSidebarOpen((current) => !current)}
                aria-label={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
              >
                <Menu size={16} />
              </button>
            ) : null}
          </div>

          <div className="toolbar-left">
            {sessionUser ? (
              <button
                className="button button-ghost"
                type="button"
                onClick={async () => {
                  await fetch(apiUrl('/api/auth/logout'), { method: 'POST' })
                  window.location.reload()
                }}
              >
                <RefreshCcw size={16} /> Sign out
              </button>
            ) : (
              <>
                <button
                  className="button button-ghost"
                  type="button"
                  onClick={() => {
                    setAuthMode('sign-in')
                    setIsAuthMenuOpen((current) => !current)
                  }}
                >
                  Sign in
                </button>
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => {
                    setAuthMode('sign-up')
                    setIsAuthMenuOpen((current) => !current)
                  }}
                >
                  Sign up
                </button>
              </>
            )}
          </div>

        </header>

        <div className={`workspace-layout ${sessionUser ? (isSidebarOpen ? 'sidebar-open' : 'sidebar-closed') : 'sidebar-closed'}`}>
          {sessionUser ? (
            <aside className="panel workspace-sidebar" aria-label="Conversation sidebar">
              <div className="sidebar-header">
                <div>
                  <div className="section-title">Chats</div>
                  <p className="section-subtitle">New chat, history, and memory.</p>
                </div>
                <button className="button button-primary" type="button" onClick={() => void startNewConversation()}>
                  <Plus size={16} /> New chat
                </button>
              </div>

              <>
                <section className="sidebar-section">
                  <div className="section-title">History</div>
                  <div className="sidebar-list">
                    {isWorkspaceLoading ? (
                      <div className="locked-panel">
                        <p className="helper">Loading your conversations...</p>
                      </div>
                    ) : threads.length === 0 ? (
                      <div className="locked-panel">
                        <p className="helper">No previous chats yet. Start a new one.</p>
                      </div>
                    ) : (
                      threads.map((thread) => {
                        const active = thread.id === chatId
                        return (
                          <button
                            key={thread.id}
                            type="button"
                            className={`sidebar-item ${active ? 'active' : ''}`}
                            onClick={() => void loadConversation(thread.id)}
                          >
                            <strong>{thread.title}</strong>
                            <small>{thread.lastMessagePreview || 'No preview available.'}</small>
                          </button>
                        )
                      })
                    )}
                  </div>
                </section>

                <section className="sidebar-section">
                  <div className="section-title">Memory</div>
                  <div className="sidebar-list">
                    {memory.length === 0 ? (
                      <div className="locked-panel">
                        <p className="helper">No saved memories yet. Chat a bit and we’ll keep useful notes here.</p>
                      </div>
                    ) : (
                      memory.map((item) => (
                        <div key={item.id} className="sidebar-memory">
                          <strong>{item.text}</strong>
                          <small>{new Date(item.createdAt).toLocaleString()}</small>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </>
            </aside>
          ) : null}

          <section className="panel chat-panel workspace-panel">
          <div className="chat-header">
            <div className="title-row">
              <div>
                <div className="section-title">Chat workspace</div>
              </div>
              <div className="header-model-slot">
                {canUseAdvancedTools ? (
                  <div className="model-switcher model-switcher-inline header-model-switcher">
                    <button
                      className="model-switcher-trigger model-switcher-compact header-model-trigger"
                      type="button"
                      onClick={() => setIsModelMenuOpen((current) => !current)}
                      aria-expanded={isModelMenuOpen}
                      aria-haspopup="menu"
                    >
                      <div className="model-switcher-copy">
                        <span className="model-switcher-label">Model</span>
                        <strong>{currentModel.label}</strong>
                      </div>
                      <ChevronDown size={14} />
                    </button>

                    {isModelMenuOpen ? (
                      <div className="model-switcher-menu" role="menu">
                        {groupedModelOptions.map((group) => (
                          <div key={group.category} className="model-switcher-group">
                            <span className="model-switcher-group-label">{group.category}</span>
                            {group.options.map((option) => {
                              const active = option.id === model
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  className={`model-switcher-item ${active ? 'active' : ''}`}
                                  onClick={() => {
                                    setModel(option.id)
                                    setIsModelMenuOpen(false)
                                  }}
                                  role="menuitemradio"
                                  aria-checked={active}
                                >
                                  <div>
                                    <strong>{option.label}</strong>
                                    <span>{option.bestFor}</span>
                                  </div>
                                  {active ? <Check size={16} /> : null}
                                </button>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="locked-model-space header-model-switcher">
                    <button
                      className="model-switcher-trigger model-switcher-locked model-switcher-compact header-model-trigger"
                      type="button"
                      disabled
                    >
                      <div className="model-switcher-copy">
                        <span className="model-switcher-label">Model</span>
                        <strong>Llama 3.1 8B</strong>
                        <span>Locked until sign in</span>
                      </div>
                      <Lock size={14} />
                    </button>
                  </div>
                )}
              </div>
              <div className="user-chip">
                <span>{sessionUser?.email ?? (isSessionLoading ? 'Loading session...' : 'Guest mode')}</span>
              </div>
            </div>

            {isAuthMenuOpen && !sessionUser ? (
              <div className="auth-popover">
                <div className="section-title">{authMode === 'sign-in' ? 'Sign in' : 'Sign up'}</div>
                <EmailOTPAuth
                  className="auth-button-wrap"
                  fullWidth
                  onSuccess={async (signedInUser) => {
                    setSessionUser(signedInUser)
                    setUserId(signedInUser.id)
                    setIsAuthMenuOpen(false)
                    window.location.reload()
                  }}
                />
              </div>
            ) : null}
          </div>

          <div className="messages">
            {messages.length === 0 ? (
              <div className="empty-state">
                <h2>How can I help?</h2>
                <p>Ask a question, upload a file, or open a tool from the plus menu.</p>
              </div>
            ) : null}

            {isThinking ? (
              <div className="thinking-indicator" aria-live="polite">
                <LoaderCircle size={16} className="spin" />
                <span>Thinking with {currentModel.label}...</span>
              </div>
            ) : null}

            {messages.map((message) => {
              const isAssistant = message.role === 'assistant'
              const displayContent = isAssistant
                ? formatAssistantDisplayText(message.content)
                : message.content

              return (
                <article key={`${message.role}-${message.content.slice(0, 24)}`} className={`message ${message.role}`}>
                  <div className="message-meta">{message.role === 'user' ? 'You' : APP_NAME}</div>
                  <div className="bubble">{displayContent}</div>
                  <div className="message-actions">
                    <button
                      type="button"
                      className="message-action"
                      onClick={() => copyMessage(message.content)}
                      aria-label="Copy message"
                    >
                      <Copy size={14} />
                    </button>
                    {isAssistant ? (
                      <>
                        <button type="button" className="message-action" aria-label="Helpful reply">
                          <ThumbsUp size={14} />
                        </button>
                        <button type="button" className="message-action" aria-label="Unhelpful reply">
                          <ThumbsDown size={14} />
                        </button>
                      </>
                    ) : null}
                  </div>
                </article>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          <form className="composer" onSubmit={handleSubmit}>
            <input ref={fileInputRef} type="file" className="sr-only" multiple onChange={handleAttachmentPick} />

            <div className="composer-toolbar">
              <button
                className="icon-button"
                type="button"
                onClick={() => setIsToolMenuOpen((current) => !current)}
                aria-label="Open tools"
                aria-expanded={isToolMenuOpen}
              >
                <Plus size={16} />
              </button>

              {isToolMenuOpen ? (
                <div className="tools-popover">
                  <button
                    className="tools-popover-item"
                    type="button"
                    onClick={() => {
                      if (!canUseAdvancedTools) {
                        setIsToolMenuOpen(false)
                        return
                      }
                      setWebSearchEnabled((current) => !current)
                      setIsToolMenuOpen(false)
                    }}
                    disabled={!canUseAdvancedTools}
                  >
                    <Search size={16} />
                    <span>
                      <strong>Web search</strong>
                      <small>
                        {canUseAdvancedTools
                          ? webSearchEnabled
                            ? 'Search the live web for this chat'
                            : 'Ground current answers with the web'
                          : 'Sign in to unlock live search'}
                      </small>
                    </span>
                  </button>
                  <button
                    className="tools-popover-item"
                    type="button"
                    onClick={() => {
                      if (!canUseAdvancedTools) {
                        setIsToolMenuOpen(false)
                        setAuthMode('sign-in')
                        setIsAuthMenuOpen(true)
                        return
                      }
                      setActiveToolPanel('canvas')
                      setIsToolMenuOpen(false)
                    }}
                    disabled={!canUseAdvancedTools}
                  >
                    <Copy size={16} />
                    <span>
                      <strong>Canvas</strong>
                      <small>{canUseAdvancedTools ? 'Edit, copy, export' : 'Sign in to unlock canvas'}</small>
                    </span>
                  </button>
                  <button
                    className="tools-popover-item"
                    type="button"
                    onClick={() => {
                      setActiveToolPanel('image')
                      setIsToolMenuOpen(false)
                    }}
                    disabled={!canUseAdvancedTools}
                  >
                    <Sparkles size={16} />
                    <span>
                      <strong>Image generation</strong>
                      <small>{canUseAdvancedTools ? 'Create visuals from a prompt' : 'Sign in to unlock image generation'}</small>
                    </span>
                  </button>
                  <button
                    className="tools-popover-item"
                    type="button"
                    onClick={() => {
                      if (!canUseAdvancedTools) {
                        setIsToolMenuOpen(false)
                        setAuthMode('sign-in')
                        setIsAuthMenuOpen(true)
                        return
                      }
                      setActiveToolPanel('video')
                      setIsToolMenuOpen(false)
                    }}
                    disabled={!canUseAdvancedTools}
                  >
                    <Video size={16} />
                    <span>
                      <strong>Video generation</strong>
                      <small>{canUseAdvancedTools ? 'Generate videos from a prompt' : 'Sign in to unlock video generation'}</small>
                    </span>
                  </button>
                  <button
                    className="tools-popover-item"
                    type="button"
                    onClick={() => {
                      if (!canUseAdvancedTools) {
                        setIsToolMenuOpen(false)
                        setAuthMode('sign-in')
                        setIsAuthMenuOpen(true)
                        return
                      }
                      setIsToolMenuOpen(false)
                      openFilePicker()
                    }}
                    disabled={!canUseAdvancedTools}
                  >
                    <Paperclip size={16} />
                    <span>
                      <strong>Upload file</strong>
                      <small>{canUseAdvancedTools ? 'Attach files to chat' : 'Sign in to unlock uploads'}</small>
                    </span>
                  </button>
                </div>
              ) : null}
            </div>

            {attachments.length > 0 ? (
              <div className="attachment-strip">
                {attachments.map((attachment) => (
                  <span key={attachment.id} className="attachment-chip">
                    <span>
                      <strong>{attachment.name}</strong>
                      <small>{attachment.type || 'file'}</small>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment.id)}
                      aria-label={`Remove ${attachment.name}`}
                    >
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
                onKeyDown={handleComposerKeyDown}
                placeholder="Ask Bag-v1 anything..."
                rows={5}
              />
              <div className="composer-send-stack">
                <button
                  className="icon-button"
                  type="button"
                  onClick={toggleListening}
                  aria-label={isListening ? 'Stop dictation' : 'Start dictation'}
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
                <div className="tts-row">
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => speak(messages.at(-1)?.content ?? 'Voice is ready.')}
                    disabled={messages.length === 0 || isSpeaking}
                    aria-label="Read last reply"
                  >
                    <Volume2 size={16} />
                  </button>
                  {canUseAdvancedTools ? (
                    <select
                      className="tts-select"
                      value={ttsModel}
                      onChange={(event) => setTtsModel(event.target.value)}
                      aria-label="TTS model"
                    >
                      {TTS_MODEL_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
                <button className="button button-primary" type="submit" disabled={isSending || input.trim().length === 0}>
                  <ArrowUpRight size={16} /> {isSending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>

            <p className="helper">{error || 'Type, dictate, upload, or use voice output.'}</p>
          </form>

          <div className="workspace-actions-row">
            <div className="quick-prompts quick-prompts-inline">
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
          </div>

          {activeToolPanel ? (
            <div className="tool-sheet">
              {activeToolPanel === 'canvas' ? (
                <div className="sidebar-card">
                  <div className="section-title">Canvas</div>
                  <textarea
                    ref={canvasRef}
                    className="textarea canvas-textarea"
                    value={canvasText}
                    onChange={(event) => setCanvasText(event.target.value)}
                    placeholder="The latest assistant reply will appear here. Edit it freely for letters, code, and documents."
                    rows={12}
                  />

                  <div className="canvas-actions">
                    <button className="button button-ghost" type="button" onClick={copyCanvas} disabled={!canvasText.trim()}>
                      <Copy size={16} /> Copy
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
                  </div>
                </div>
              ) : null}

              {activeToolPanel === 'image' ? (
                <div className="sidebar-card">
                  <div className="section-title">Image generation</div>

                  {canUseAdvancedTools ? (
                    <>
                      <div className="model-picker-row">
                        <select
                          className="control"
                          value={imageModel}
                          onChange={(event) => setImageModel(event.target.value)}
                          disabled={isGeneratingImage}
                        >
                          {IMAGE_MODEL_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <textarea
                        ref={imageRef}
                        className="textarea"
                        value={imagePrompt}
                        onChange={(event) => setImagePrompt(event.target.value)}
                        placeholder="Describe the image you want..."
                        rows={4}
                      />
                      <button className="button button-primary" type="button" onClick={generateImage} disabled={isGeneratingImage}>
                        <Sparkles size={16} /> {isGeneratingImage ? 'Generating...' : 'Generate image'}
                      </button>

                      {imageError ? <div className="error">{imageError}</div> : null}

                      <div className="image-preview">
                        {imageUrl ? (
                          <img src={imageUrl} alt="Generated result" />
                        ) : (
                          <div className="placeholder">
                            <strong>No image yet.</strong>
                            <div className="meta">Generate one to preview the image result.</div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="locked-panel">
                      <p className="helper">Sign in to use image generation.</p>
                    </div>
                  )}
                </div>
              ) : null}

              {activeToolPanel === 'video' ? (
                <div className="sidebar-card">
                  <div className="section-title">Video generation</div>

                  {canUseAdvancedTools ? (
                    <>
                      <div className="model-picker-row">
                        <select
                          className="control"
                          value={videoModel}
                          onChange={(event) => setVideoModel(event.target.value)}
                          disabled={isGeneratingVideo}
                        >
                          {VIDEO_MODEL_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <textarea
                        className="textarea"
                        value={videoPrompt}
                        onChange={(event) => setVideoPrompt(event.target.value)}
                        placeholder="Describe the video you want to generate..."
                        rows={4}
                      />
                      <button className="button button-primary" type="button" onClick={generateVideo} disabled={isGeneratingVideo}>
                        <Video size={16} /> {isGeneratingVideo ? 'Generating...' : 'Generate video'}
                      </button>

                      {videoError ? <div className="error">{videoError}</div> : null}

                      {isGeneratingVideo ? (
                        <div className="spinner-container">
                          <LoaderCircle size={32} className="spin" />
                          <p className="meta">Generating your video with Cosmos...</p>
                        </div>
                      ) : null}

                      <div className="video-preview">
                        {videoUrl ? (
                          <>
                            <video src={videoUrl} controls className="video-player" />
                            <a
                              href={videoUrl}
                              download
                              className="button button-ghost"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Download size={16} /> Download
                            </a>
                          </>
                        ) : (
                          <div className="placeholder">
                            <strong>No video yet.</strong>
                            <div className="meta">Generate one to preview the Cosmos video result.</div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="locked-panel">
                      <p className="helper">Sign in to use video generation.</p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
          </section>
        </div>
      </div>
    </main>
  )
}
