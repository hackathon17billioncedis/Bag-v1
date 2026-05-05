import { DEFAULT_MODEL } from '@/lib/models'

export type ChatRole = 'user' | 'assistant'

export type ChatEntry = {
  role: ChatRole
  content: string
  model: string
  timestamp: string
  userEmail?: string
}

export type ConversationThread = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
  lastMessageAt: string | null
  lastMessagePreview: string | null
  lastModel: string | null
}

export type MemoryItem = {
  id: string
  text: string
  createdAt: string
  sourceChatId: string
}

const USER_SET_KEY = 'bag-v1:users'
const CHAT_COUNT_KEY = 'bag-v1:stats:chat_count'
const IMAGE_COUNT_KEY = 'bag-v1:stats:image_count'
const MODEL_COUNTS_KEY = 'bag-v1:stats:model_counts'

function isPlaceholderStorageValue(value: string | undefined) {
  if (!value) {
    return true
  }

  const normalized = value.trim().toLowerCase()
  return (
    normalized.length === 0 ||
    normalized.includes('your-kv') ||
    normalized.includes('placeholder') ||
    normalized.includes('replace-me')
  )
}

async function getKvClient() {
  if (
    isPlaceholderStorageValue(process.env.KV_REST_API_URL) ||
    isPlaceholderStorageValue(process.env.KV_REST_API_TOKEN)
  ) {
    return null
  }

  try {
    const { kv } = await import('@vercel/kv')
    return kv
  } catch {
    return null
  }
}

function threadIdsKey(userId: string) {
  return `bag-v1:user:${userId}:threads`
}

function threadMetaKey(userId: string, chatId: string) {
  return `bag-v1:user:${userId}:chat:${chatId}:meta`
}

function threadHistoryKey(userId: string, chatId: string) {
  return `bag-v1:user:${userId}:chat:${chatId}:messages`
}

function activeThreadKey(userId: string) {
  return `bag-v1:user:${userId}:active_chat`
}

function memoryKey(userId: string) {
  return `bag-v1:user:${userId}:memory`
}

function safeParseEntries(raw: unknown): ChatEntry[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .map((entry): ChatEntry | null => {
      if (!entry || typeof entry !== 'object') {
        return null
      }

      const item = entry as Partial<ChatEntry>
      if (typeof item.role !== 'string' || typeof item.content !== 'string') {
        return null
      }

      return {
        role: item.role === 'assistant' ? 'assistant' : 'user',
        content: item.content,
        model: typeof item.model === 'string' ? item.model : DEFAULT_MODEL,
        timestamp: typeof item.timestamp === 'string' ? item.timestamp : new Date().toISOString(),
        userEmail: typeof item.userEmail === 'string' ? item.userEmail : undefined,
      }
    })
    .filter((entry): entry is ChatEntry => Boolean(entry))
}

export function normalizeTitle(input: string) {
  const cleaned = input
    .replace(/\s+/g, ' ')
    .replace(/[“”]/g, '"')
    .trim()

  if (!cleaned) {
    return 'New chat'
  }

  const words = cleaned.split(' ').slice(0, 6)
  const title = words.join(' ')
  return title.length > 42 ? `${title.slice(0, 39)}...` : title
}

function deriveMemoryNote(userMessage: string, assistantMessage: string) {
  const user = userMessage.trim()
  const assistant = assistantMessage.trim()

  if (!user) {
    return ''
  }

  const lower = user.toLowerCase()

  if (lower.includes('my name is')) {
    return `User identity: ${normalizeTitle(user)}`
  }

  if (lower.includes('call me')) {
    return `Preferred name: ${normalizeTitle(user)}`
  }

  if (lower.includes('i prefer') || lower.includes('i like') || lower.includes('i want')) {
    return `Preference: ${normalizeTitle(user)}`
  }

  if (lower.includes('remember') || lower.includes('keep in mind')) {
    return `Remember: ${normalizeTitle(user)}`
  }

  if (assistant) {
    return `Discussed ${normalizeTitle(user)}`
  }

  return normalizeTitle(user)
}

async function loadThreads(kv: Awaited<ReturnType<typeof getKvClient>>, userId: string) {
  if (!kv) {
    return []
  }

  const threadIds = (await kv.smembers(threadIdsKey(userId))) as string[]
  if (!threadIds.length) {
    return []
  }

  const threads = await Promise.all(
    threadIds.map(async (chatId) => {
      const thread = await kv.get<ConversationThread>(threadMetaKey(userId, chatId))
      return thread
    }),
  )

  return threads.filter((thread): thread is ConversationThread => Boolean(thread))
}

async function saveThread(kv: Awaited<ReturnType<typeof getKvClient>>, userId: string, thread: ConversationThread) {
  if (!kv) {
    return false
  }

  await kv.set(threadMetaKey(userId, thread.id), thread)
  await kv.sadd(threadIdsKey(userId), thread.id)
  await kv.set(activeThreadKey(userId), thread.id)
  await kv.sadd(USER_SET_KEY, userId)
  return true
}

function trimThreads(threads: ConversationThread[]) {
  return threads.sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt)
    const rightTime = Date.parse(right.updatedAt)
    return rightTime - leftTime
  })
}

export async function listConversations(userId: string) {
  try {
    const kv = await getKvClient()
    if (!kv) {
      return { storageAvailable: false, threads: [] as ConversationThread[], activeChatId: '' }
    }

    const [threads, activeChatId] = await Promise.all([
      loadThreads(kv, userId),
      kv.get<string>(activeThreadKey(userId)),
    ])

    return {
      storageAvailable: true,
      threads: trimThreads(threads),
      activeChatId: activeChatId ?? '',
    }
  } catch {
    return { storageAvailable: false, threads: [] as ConversationThread[], activeChatId: '' }
  }
}

export async function createConversationThread(
  userId: string,
  chatId: string,
  title: string,
  model: string = DEFAULT_MODEL,
) {
  try {
    const kv = await getKvClient()
    if (!kv) {
      return { storageAvailable: false }
    }

    const now = new Date().toISOString()
    const existing = await kv.get<ConversationThread>(threadMetaKey(userId, chatId))
    const thread: ConversationThread = {
      id: chatId,
      title: existing?.title ?? title,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      messageCount: existing?.messageCount ?? 0,
      lastMessageAt: existing?.lastMessageAt ?? null,
      lastMessagePreview: existing?.lastMessagePreview ?? null,
      lastModel: existing?.lastModel ?? model,
    }

    await saveThread(kv, userId, thread)
    return { storageAvailable: true, thread }
  } catch {
    return { storageAvailable: false }
  }
}

export async function appendConversationEntry(userId: string, chatId: string, entry: ChatEntry) {
  try {
    const kv = await getKvClient()
    if (!kv) {
      return { storageAvailable: false }
    }

    const historyKey = threadHistoryKey(userId, chatId)
    const current = safeParseEntries(await kv.get<ChatEntry[]>(historyKey))
    const next = [...current, entry].slice(-80)

    await kv.set(historyKey, next)
    await kv.sadd(USER_SET_KEY, userId)
    await kv.incr(CHAT_COUNT_KEY)
    await kv.hincrby(MODEL_COUNTS_KEY, entry.model, 1)

    const threadRaw = await kv.get<ConversationThread>(threadMetaKey(userId, chatId))
    const existingThread = threadRaw ?? {
      id: chatId,
      title: 'New chat',
      createdAt: entry.timestamp,
      updatedAt: entry.timestamp,
      messageCount: 0,
      lastMessageAt: null,
      lastMessagePreview: null,
      lastModel: entry.model,
    }

    const firstUserMessage = current.find((message) => message.role === 'user')?.content
    const updatedThread: ConversationThread = {
      ...existingThread,
      title:
        existingThread.title === 'New chat' && entry.role === 'user'
          ? normalizeTitle(entry.content)
          : existingThread.title || normalizeTitle(firstUserMessage ?? entry.content),
      updatedAt: entry.timestamp,
      messageCount: next.length,
      lastMessageAt: entry.timestamp,
      lastMessagePreview: entry.content.slice(0, 120),
      lastModel: entry.model,
    }

    await saveThread(kv, userId, updatedThread)

    if (entry.role === 'assistant') {
      const memoryText = deriveMemoryNote(firstUserMessage ?? '', entry.content)
      if (memoryText) {
        await appendMemoryNote(userId, {
          id: crypto.randomUUID(),
          text: memoryText,
          createdAt: entry.timestamp,
          sourceChatId: chatId,
        })
      }
    }

    return { storageAvailable: true }
  } catch {
    return { storageAvailable: false }
  }
}

export async function appendImagePrompt(userId: string, prompt: string, model: string, userEmail?: string) {
  try {
    const kv = await getKvClient()
    if (!kv) {
      return { storageAvailable: false }
    }

    const now = new Date().toISOString()
    await kv.sadd(USER_SET_KEY, userId)
    await kv.incr(IMAGE_COUNT_KEY)
    await kv.hincrby(MODEL_COUNTS_KEY, model, 1)

    return { storageAvailable: true, prompt, model, userEmail: userEmail ?? '', timestamp: now }
  } catch {
    return { storageAvailable: false }
  }
}

export async function getConversationHistory(userId: string, chatId?: string) {
  try {
    const kv = await getKvClient()
    if (!kv) {
      return { storageAvailable: false, entries: [] as ChatEntry[] }
    }

    const activeChatId = chatId?.trim() || (await kv.get<string>(activeThreadKey(userId))) || ''
    if (!activeChatId) {
      return { storageAvailable: true, entries: [] as ChatEntry[] }
    }

    const raw = await kv.get<ChatEntry[]>(threadHistoryKey(userId, activeChatId))
    const entries = safeParseEntries(raw)
    return { storageAvailable: true, entries }
  } catch {
    return { storageAvailable: false, entries: [] as ChatEntry[] }
  }
}

export async function getUserMemory(userId: string) {
  try {
    const kv = await getKvClient()
    if (!kv) {
      return { storageAvailable: false, items: [] as MemoryItem[] }
    }

    const raw = await kv.lrange(memoryKey(userId), 0, 49)
    const items = (raw ?? [])
      .map((entry): MemoryItem | null => {
        if (typeof entry !== 'string') {
          return null
        }

        try {
          const parsed = JSON.parse(entry) as Partial<MemoryItem>
          if (typeof parsed.id !== 'string' || typeof parsed.text !== 'string') {
            return null
          }

          return {
            id: parsed.id,
            text: parsed.text,
            createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date().toISOString(),
            sourceChatId: typeof parsed.sourceChatId === 'string' ? parsed.sourceChatId : '',
          }
        } catch {
          return null
        }
      })
      .filter((entry): entry is MemoryItem => Boolean(entry))
      .reverse()

    return { storageAvailable: true, items }
  } catch {
    return { storageAvailable: false, items: [] as MemoryItem[] }
  }
}

export async function appendMemoryNote(userId: string, note: MemoryItem) {
  try {
    const kv = await getKvClient()
    if (!kv) {
      return { storageAvailable: false }
    }

    const existing = await kv.lrange(memoryKey(userId), 0, 49)
    const deduped = (existing ?? []).filter((entry) => {
      if (typeof entry !== 'string') {
        return true
      }

      try {
        const parsed = JSON.parse(entry) as Partial<MemoryItem>
        return parsed.text?.trim().toLowerCase() !== note.text.trim().toLowerCase()
      } catch {
        return true
      }
    })

    await kv.del(memoryKey(userId))
    await kv.rpush(memoryKey(userId), ...deduped, JSON.stringify(note))
    await kv.ltrim(memoryKey(userId), 0, 24)

    return { storageAvailable: true }
  } catch {
    return { storageAvailable: false }
  }
}

export type AdminOverview = {
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

export async function getAdminOverview(): Promise<AdminOverview> {
  try {
    const kv = await getKvClient()
    if (!kv) {
      return {
        storageAvailable: false,
        stats: {
          chatCount: 0,
          imageCount: 0,
          userCount: 0,
          modelCounts: {},
        },
        users: [],
      }
    }

    const [chatCountRaw, imageCountRaw, modelCountsRaw, userIds] = await Promise.all([
      kv.get<number>(CHAT_COUNT_KEY),
      kv.get<number>(IMAGE_COUNT_KEY),
      kv.hgetall<Record<string, number>>(MODEL_COUNTS_KEY),
      kv.smembers(USER_SET_KEY),
    ])

    const users = await Promise.all(
      (userIds as string[]).map(async (userId) => {
        const threads = trimThreads(await loadThreads(kv, userId))
        const histories = await Promise.all(
          threads.map(async (thread) => ({
            thread,
            history: safeParseEntries(await kv.lrange(threadHistoryKey(userId, thread.id), 0, 49)),
          })),
        )

        const lastHistory = histories
          .flatMap((item) => item.history.map((entry) => ({ ...entry, threadId: item.thread.id })))
          .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))[0] ?? null

        const totalMessages = histories.reduce((sum, item) => sum + item.history.length, 0)
        return {
          userId,
          messageCount: totalMessages,
          lastActivityAt: lastHistory?.timestamp ?? null,
          lastModel: lastHistory?.model ?? null,
        }
      }),
    )

    users.sort((left, right) => {
      const leftTime = left.lastActivityAt ? Date.parse(left.lastActivityAt) : 0
      const rightTime = right.lastActivityAt ? Date.parse(right.lastActivityAt) : 0
      return rightTime - leftTime
    })

    return {
      storageAvailable: true,
      stats: {
        chatCount: Number(chatCountRaw ?? 0),
        imageCount: Number(imageCountRaw ?? 0),
        userCount: userIds.length,
        modelCounts: modelCountsRaw ?? {},
      },
      users,
    }
  } catch {
    return {
      storageAvailable: false,
      stats: {
        chatCount: 0,
        imageCount: 0,
        userCount: 0,
        modelCounts: {},
      },
      users: [],
    }
  }
}
