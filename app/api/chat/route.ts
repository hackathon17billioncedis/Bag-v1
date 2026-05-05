import { NextResponse } from 'next/server'
import { DEFAULT_MODEL, MODEL_OPTIONS, SYSTEM_PROMPT, normalizeModelId } from '@/lib/models'
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
  userId?: string
  userEmail?: string
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
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENROUTER_API_KEY is not configured.' },
      { status: 500 },
    )
  }

  const sessionUser = await getSessionUserFromRequest(request)

  const siteUrl = process.env.SITE_URL ?? process.env.APP_URL ?? 'http://localhost:3000'
  const appName = process.env.APP_NAME ?? 'Bag-v1'

  let body: ChatRequest
  try {
    body = (await request.json()) as ChatRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const userId = sessionUser?.id?.trim() || body.userId?.trim() || 'anonymous'
  const userEmail = sessionUser?.email?.trim() || body.userEmail?.trim() || ''
  const model = resolveModel(body.model, Boolean(sessionUser))
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

  const payload = {
    model,
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...contextualMessages],
    temperature: 0.7,
    max_tokens: 1200,
  }

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': siteUrl,
      'X-Title': appName,
    },
    body: JSON.stringify({ ...payload, stream: true }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    return NextResponse.json(
      {
        error: `OpenRouter request failed with status ${response.status}.`,
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

        if (reply.trim()) {
          await appendConversationEntry(userId, {
            role: 'user',
            content: messages.at(-1)?.content ?? '',
            model,
            userEmail,
            timestamp: new Date().toISOString(),
          })
          await appendConversationEntry(userId, {
            role: 'assistant',
            content: reply.trim(),
            model,
            userEmail,
            timestamp: new Date().toISOString(),
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
