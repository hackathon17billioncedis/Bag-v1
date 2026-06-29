import { NextResponse } from 'next/server'
import { DEFAULT_MODEL, MODEL_OPTIONS, SYSTEM_PROMPT, normalizeModelId } from '@/lib/models'
import { NVIDIA_BASE_URL, isNvidiaChatModel } from '@/lib/nvidia'
import { appendConversationEntry } from '@/lib/persistence'
import { getSessionUserFromRequest } from '@/lib/auth'

type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type ChatRequest = {
  message?: string
  messages?: ChatMessage[]
  model?: string
  webSearchEnabled?: boolean
  userId?: string
  userEmail?: string
  chatId?: string
  attachments?: Array<{
    id?: string
    name?: string
    type?: string
    content?: string
    size?: number
  }>
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

function sanitizeMessages(messages: ChatMessage[] | undefined, fallbackMessage: string) {
  const cleaned = (messages ?? [])
    .filter((message) => message && typeof message.content === 'string' && message.content.trim().length > 0)
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))

  if (cleaned.length === 0 && fallbackMessage.trim()) {
    cleaned.push({ role: 'user', content: fallbackMessage.trim() })
  }

  return cleaned
}

function buildAttachmentBlock(
  attachments: ChatRequest['attachments'] | undefined,
) {
  const readable = (attachments ?? [])
    .filter((file) => file && typeof file.content === 'string' && file.content.trim().length > 0)
    .map((file) => ({
      name: typeof file.name === 'string' ? file.name : 'attachment',
      type: typeof file.type === 'string' ? file.type : 'unknown',
      content: file.content!.trim(),
      size: typeof file.size === 'number' ? file.size : 0,
    }))

  if (readable.length === 0) {
    return ''
  }

  return [
    'Attached files:',
    ...readable.map(
      (file, index) =>
        `${index + 1}. ${file.name} (${file.type}, ${file.size} bytes)\n${file.content}`,
    ),
  ].join('\n\n')
}

function resolveModel(model: string | undefined, isSignedIn: boolean) {
  if (!isSignedIn) {
    return DEFAULT_MODEL
  }

  const requestedModel = normalizeModelId(model?.trim() || DEFAULT_MODEL)
  return MODEL_OPTIONS.some((option) => option.id === requestedModel) ? requestedModel : DEFAULT_MODEL
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUserFromRequest(request)

  let body: ChatRequest
  try {
    body = (await request.json()) as ChatRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const userId = sessionUser?.id?.trim() || body.userId?.trim() || 'anonymous'
  const userEmail = sessionUser?.email?.trim() || body.userEmail?.trim() || ''
  const chatId = body.chatId?.trim() || 'default'
  const model = resolveModel(body.model, Boolean(sessionUser))
  const webSearchEnabled = Boolean(sessionUser) && body.webSearchEnabled === true
  const attachmentsBlock = buildAttachmentBlock(body.attachments)
  const messages = sanitizeMessages(body.messages, body.message ?? '')

  if (messages.length === 0) {
    return NextResponse.json({ error: 'Please send a message.' }, { status: 400 })
  }

  const contextualMessages = attachmentsBlock
    ? [
        ...messages.slice(0, -1),
        {
          role: 'user' as const,
          content: `${messages.at(-1)?.content ?? ''}\n\n${attachmentsBlock}`.trim(),
        },
      ]
    : messages

  const isNvidia = isNvidiaChatModel(model)

  if (isNvidia) {
    const nvidiaKey = process.env.NVIDIA_API_KEY
    if (!nvidiaKey) {
      return NextResponse.json(
        { error: 'NVIDIA_API_KEY is not configured.' },
        { status: 500 },
      )
    }
  } else {
    const openRouterKey = process.env.OPENROUTER_API_KEY
    if (!openRouterKey) {
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY is not configured.' },
        { status: 500 },
      )
    }
  }

  const siteUrl = process.env.SITE_URL ?? process.env.APP_URL ?? 'http://localhost:3000'
  const appName = process.env.APP_NAME ?? 'Bag-v1'

  const payload = {
    model,
    messages: [
      {
        role: 'system',
        content: webSearchEnabled && !isNvidia
          ? `${SYSTEM_PROMPT}\nYou are always Bag-v1, even if the underlying model changes.\nUse web search when the user asks for current, recent, local, or fact-sensitive information. Keep the answer grounded, concise, and cite useful sources naturally.`
          : `${SYSTEM_PROMPT}\nYou are always Bag-v1, even if the underlying model changes.`,
      },
      ...contextualMessages,
    ],
    temperature: 0.7,
    max_tokens: 1200,
    ...(webSearchEnabled && !isNvidia
      ? {
          tools: [{ type: 'openrouter:web_search' }],
        }
      : {}),
  }

  const apiUrl = isNvidia ? `${NVIDIA_BASE_URL}/chat/completions` : OPENROUTER_URL
  const headers: Record<string, string> = {
    Authorization: `Bearer ${isNvidia ? process.env.NVIDIA_API_KEY : process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
  }
  if (!isNvidia) {
    headers['HTTP-Referer'] = siteUrl
    headers['X-Title'] = appName
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...payload, stream: true }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    return NextResponse.json(
      {
        error: `Chat request failed with status ${response.status}.`,
        details: errorText,
      },
      { status: response.status },
    )
  }

  if (!response.body) {
    return NextResponse.json(
      { error: 'The model returned no stream body.' },
      { status: 502 },
    )
  }

  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ''
  let reply = ''

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = response.body!.getReader()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            break
          }

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const rawLine of lines) {
            const line = rawLine.trim()
            if (!line.startsWith('data:')) {
              continue
            }

            const data = line.slice(5).trim()
            if (!data || data === '[DONE]') {
              continue
            }

            try {
              const parsed = JSON.parse(data) as {
                choices?: Array<{
                  delta?: { content?: string }
                }>
              }

              const delta = parsed.choices?.[0]?.delta?.content ?? ''
              if (delta) {
                reply += delta
                controller.enqueue(encoder.encode(delta))
              }
            } catch {
              // Ignore malformed chunks and keep streaming.
            }
          }
        }

        if (buffer.trim().startsWith('data:')) {
          const data = buffer.trim().slice(5).trim()
          if (data && data !== '[DONE]') {
            try {
              const parsed = JSON.parse(data) as {
                choices?: Array<{
                  delta?: { content?: string }
                }>
              }
              const delta = parsed.choices?.[0]?.delta?.content ?? ''
              if (delta) {
                reply += delta
                controller.enqueue(encoder.encode(delta))
              }
            } catch {
              // Ignore malformed trailing chunk.
            }
          }
        }

        if (reply.trim() && sessionUser) {
          const timestamp = new Date().toISOString()
          await appendConversationEntry(userId, chatId, {
            role: 'user',
            content: messages.at(-1)?.content ?? '',
            model,
            userEmail,
            timestamp,
          })
          await appendConversationEntry(userId, chatId, {
            role: 'assistant',
            content: reply.trim(),
            model,
            userEmail,
            timestamp,
          })
        }

        controller.close()
      } catch (error) {
        controller.error(error)
      } finally {
        reader.releaseLock()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
