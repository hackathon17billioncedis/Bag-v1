import { DEFAULT_MODEL } from '@/lib/models'

export type ChatRole = 'user' | 'assistant'

export type ChatEntry = {
  role: ChatRole
  content: string
  model: string
  timestamp: string
}

const USER_SET_KEY = 'bag-v1:users'
const CHAT_COUNT_KEY = 'bag-v1:stats:chat_count'
const IMAGE_COUNT_KEY = 'bag-v1:stats:image_count'
const MODEL_COUNTS_KEY = 'bag-v1:stats:model_counts'

async function getKvClient() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return null
  }

  try {
    const { kv } = await import('@vercel/kv')
    return kv
  } catch {
    return null
  }
}

function chatKey(userId: string) {
  return `bag-v1:user:${userId}:chat`
}

function safeParseEntries(raw: unknown): ChatEntry[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .map((entry) => {
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
      } satisfies ChatEntry
    })
    .filter((entry): entry is ChatEntry => Boolean(entry))
}

export async function appendConversationEntry(userId: string, entry: ChatEntry) {
  const kv = await getKvClient()
  if (!kv) {
    return { storageAvailable: false }
  }

  const key = chatKey(userId)
  const current = safeParseEntries(await kv.get<ChatEntry[]>(key))
  const next = [...current, entry].slice(-50)

  await kv.set(key, next)
  await kv.sadd(USER_SET_KEY, userId)
  await kv.incr(CHAT_COUNT_KEY)
  await kv.hincrby(MODEL_COUNTS_KEY, entry.model, 1)

  return { storageAvailable: true }
}

export async function appendImagePrompt(userId: string, prompt: string, model: string) {
  const kv = await getKvClient()
  if (!kv) {
    return { storageAvailable: false }
  }

  await kv.sadd(USER_SET_KEY, userId)
  await kv.incr(IMAGE_COUNT_KEY)
  await kv.hincrby(MODEL_COUNTS_KEY, model, 1)
  await kv.lpush(`bag-v1:user:${userId}:images`, JSON.stringify({
    prompt,
    model,
    timestamp: new Date().toISOString(),
  }))
  await kv.ltrim(`bag-v1:user:${userId}:images`, 0, 49)

  return { storageAvailable: true }
}

export async function getConversationHistory(userId: string) {
  const kv = await getKvClient()
  if (!kv) {
    return { storageAvailable: false, entries: [] as ChatEntry[] }
  }

  const raw = await kv.get<ChatEntry[]>(chatKey(userId))
  const entries = safeParseEntries(raw)
  return { storageAvailable: true, entries }
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

export async function getAdminOverview() : Promise<AdminOverview> {
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
      const history = safeParseEntries(await kv.lrange(chatKey(userId), 0, 49))
      const last = history.at(-1) ?? null
      return {
        userId,
        messageCount: history.length,
        lastActivityAt: last?.timestamp ?? null,
        lastModel: last?.model ?? null,
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
}
