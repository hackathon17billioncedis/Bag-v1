import { neon } from '@neondatabase/serverless'
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

type QueryFn = <TResult = Record<string, unknown>[]>(
  strings: TemplateStringsArray,
  ...params: unknown[]
) => Promise<TResult>

function isPlaceholderStorageValue(value: string | undefined) {
  if (!value) {
    return true
  }

  const normalized = value.trim().toLowerCase()
  return (
    normalized.length === 0 ||
    normalized.includes('your-database') ||
    normalized.includes('your-neon') ||
    normalized.includes('placeholder') ||
    normalized.includes('replace-me')
  )
}

let cachedSql: QueryFn | null = null

async function getSql(): Promise<QueryFn | null> {
  if (cachedSql) {
    return cachedSql
  }

  const url = process.env.DATABASE_URL
  if (!url || isPlaceholderStorageValue(url)) {
    return null
  }

  try {
    cachedSql = neon(url) as unknown as QueryFn
    return cachedSql
  } catch {
    return null
  }
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

type ThreadRow = {
  id: string
  user_id: string
  title: string
  created_at: Date
  updated_at: Date
  message_count: number
  last_message_at: Date | null
  last_message_preview: string | null
  last_model: string | null
}

function threadFromRow(row: ThreadRow): ConversationThread {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    messageCount: Number(row.message_count ?? 0),
    lastMessageAt: row.last_message_at ? row.last_message_at.toISOString() : null,
    lastMessagePreview: row.last_message_preview,
    lastModel: row.last_model,
  }
}

async function ensureUser(sql: QueryFn, userId: string) {
  await sql`
    INSERT INTO bag_users (user_id)
    VALUES (${userId})
    ON CONFLICT (user_id) DO NOTHING
  `
}

async function setActiveThread(sql: QueryFn, userId: string, chatId: string) {
  await sql`
    INSERT INTO bag_user_meta (user_id, active_thread_id)
    VALUES (${userId}, ${chatId})
    ON CONFLICT (user_id)
    DO UPDATE SET active_thread_id = EXCLUDED.active_thread_id
  `
}

export async function listConversations(userId: string) {
  try {
    const sql = await getSql()
    if (!sql) {
      return { storageAvailable: false, threads: [] as ConversationThread[], activeChatId: '' }
    }

    const [threadRows, metaRows] = await Promise.all([
      sql<ThreadRow[]>`
        SELECT id, user_id, title, created_at, updated_at, message_count,
               last_message_at, last_message_preview, last_model
        FROM bag_threads
        WHERE user_id = ${userId}
        ORDER BY updated_at DESC
      `,
      sql<{ active_thread_id: string | null }[]>`
        SELECT active_thread_id
        FROM bag_user_meta
        WHERE user_id = ${userId}
      `,
    ])

    const threads = threadRows.map(threadFromRow)
    const activeChatId = metaRows[0]?.active_thread_id ?? ''

    return { storageAvailable: true, threads, activeChatId }
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
    const sql = await getSql()
    if (!sql) {
      return { storageAvailable: false }
    }

    const now = new Date()
    const thread: ConversationThread = {
      id: chatId,
      title,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      messageCount: 0,
      lastMessageAt: null,
      lastMessagePreview: null,
      lastModel: model,
    }

    await sql`
      INSERT INTO bag_threads (
        id, user_id, title, created_at, updated_at,
        message_count, last_message_at, last_message_preview, last_model
      )
      VALUES (
        ${chatId}, ${userId}, ${title}, ${now}, ${now},
        0, NULL, NULL, ${model}
      )
      ON CONFLICT (id) DO NOTHING
    `
    await ensureUser(sql, userId)
    await setActiveThread(sql, userId, chatId)

    const saved = await sql<ThreadRow[]>`
      SELECT id, user_id, title, created_at, updated_at,
             message_count, last_message_at, last_message_preview, last_model
      FROM bag_threads
      WHERE id = ${chatId}
    `

    const createdThread: ConversationThread = {
      ...thread,
      ...(saved[0] ? threadFromRow(saved[0]) : null),
    }
    return { storageAvailable: true, thread: createdThread }
  } catch {
    return { storageAvailable: false }
  }
}

function trimThreads(threads: ConversationThread[]) {
  return threads.sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt)
    const rightTime = Date.parse(right.updatedAt)
    return rightTime - leftTime
  })
}

export async function appendConversationEntry(userId: string, chatId: string, entry: ChatEntry) {
  try {
    const sql = await getSql()
    if (!sql) {
      return { storageAvailable: false }
    }

    const timestamp = entry.timestamp || new Date().toISOString()

    await sql`
      INSERT INTO bag_messages (
        thread_id, user_id, role, content, model, message_time, user_email
      )
      VALUES (
        ${chatId}, ${userId}, ${entry.role}, ${entry.content}, ${entry.model},
        ${timestamp}::timestamptz, ${entry.userEmail ?? null}
      )
    `
    await ensureUser(sql, userId)

    const firstUserMessage = await sql<{ content: string }[]>`
      SELECT content
      FROM bag_messages
      WHERE thread_id = ${chatId} AND user_id = ${userId} AND role = 'user'
      ORDER BY id ASC
      LIMIT 1
    `
    const firstText = firstUserMessage[0]?.content ?? ''

    const threadRaw = await sql<ThreadRow[]>`
      SELECT id, user_id, title, created_at, updated_at,
             message_count, last_message_at, last_message_preview, last_model
      FROM bag_threads
      WHERE id = ${chatId}
    `
    const existingThread = threadRaw[0] ? threadFromRow(threadRaw[0]) : threadFromRow({
      id: chatId,
      user_id: userId,
      title: 'New chat',
      created_at: new Date(),
      updated_at: new Date(),
      message_count: 0,
      last_message_at: null,
      last_message_preview: null,
      last_model: entry.model,
    })

    const updatedThread: ConversationThread = {
      ...existingThread,
      title:
        existingThread.title === 'New chat' && entry.role === 'user'
          ? normalizeTitle(entry.content)
          : existingThread.title || normalizeTitle(firstText || entry.content),
      updatedAt: timestamp,
      messageCount: existingThread.messageCount + 1,
      lastMessageAt: timestamp,
      lastMessagePreview: entry.content.slice(0, 120),
      lastModel: entry.model,
    }

    await sql`
      UPDATE bag_threads
      SET title = ${updatedThread.title},
          updated_at = ${timestamp}::timestamptz,
          message_count = ${updatedThread.messageCount},
          last_message_at = ${timestamp}::timestamptz,
          last_message_preview = ${updatedThread.lastMessagePreview},
          last_model = ${updatedThread.lastModel}
      WHERE id = ${chatId}
    `
    await ensureUser(sql, userId)
    await setActiveThread(sql, userId, chatId)

    if (entry.role === 'assistant') {
      const memoryText = deriveMemoryNote(firstText, entry.content)
      if (memoryText) {
        await appendMemoryNote(userId, {
          id: crypto.randomUUID(),
          text: memoryText,
          createdAt: timestamp,
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
    const sql = await getSql()
    if (!sql) {
      return { storageAvailable: false }
    }

    const now = new Date().toISOString()
    await ensureUser(sql, userId)
    await sql`
      INSERT INTO bag_images (user_id, prompt, model, user_email, created_at)
      VALUES (${userId}, ${prompt}, ${model}, ${userEmail ?? null}, ${now}::timestamptz)
    `

    return { storageAvailable: true, prompt, model, userEmail: userEmail ?? '', timestamp: now }
  } catch {
    return { storageAvailable: false }
  }
}

function parseEntries(rows: Array<{ role: string; content: string; model: string; message_time: Date; user_email: string | null }>): ChatEntry[] {
  return rows.map((row) => ({
    role: row.role === 'assistant' ? 'assistant' : 'user',
    content: row.content,
    model: typeof row.model === 'string' && row.model ? row.model : DEFAULT_MODEL,
    timestamp: row.message_time.toISOString(),
    userEmail: row.user_email ?? undefined,
  }))
}

export async function getConversationHistory(userId: string, chatId?: string) {
  try {
    const sql = await getSql()
    if (!sql) {
      return { storageAvailable: false, entries: [] as ChatEntry[] }
    }

    let activeChatId = chatId?.trim() || ''
    if (!activeChatId) {
      const meta = await sql<{ active_thread_id: string | null }[]>`
        SELECT active_thread_id
        FROM bag_user_meta
        WHERE user_id = ${userId}
      `
      activeChatId = meta[0]?.active_thread_id ?? ''
    }

    if (!activeChatId) {
      return { storageAvailable: true, entries: [] as ChatEntry[] }
    }

    const rows = await sql<Array<{
      role: string
      content: string
      model: string
      message_time: Date
      user_email: string | null
    }>>`
      SELECT role, content, model, message_time, user_email
      FROM bag_messages
      WHERE thread_id = ${activeChatId} AND user_id = ${userId}
      ORDER BY id ASC
    `

    return { storageAvailable: true, entries: parseEntries(rows) }
  } catch {
    return { storageAvailable: false, entries: [] as ChatEntry[] }
  }
}

export async function getUserMemory(userId: string) {
  try {
    const sql = await getSql()
    if (!sql) {
      return { storageAvailable: false, items: [] as MemoryItem[] }
    }

    const rows = await sql<{ items: unknown }[]>`
      SELECT items
      FROM bag_memory
      WHERE user_id = ${userId}
    `
    const raw = rows[0]?.items

    if (!Array.isArray(raw)) {
      return { storageAvailable: true, items: [] as MemoryItem[] }
    }

    const items = (raw as unknown[])
      .map((entry): MemoryItem | null => {
        if (!entry || typeof entry !== 'object') {
          return null
        }

        const parsed = entry as Partial<MemoryItem>
        if (typeof parsed.id !== 'string' || typeof parsed.text !== 'string') {
          return null
        }

        return {
          id: parsed.id,
          text: parsed.text,
          createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date().toISOString(),
          sourceChatId: typeof parsed.sourceChatId === 'string' ? parsed.sourceChatId : '',
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
    const sql = await getSql()
    if (!sql) {
      return { storageAvailable: false }
    }

    const rows = await sql<{ items: unknown }[]>`
      SELECT items
      FROM bag_memory
      WHERE user_id = ${userId}
    `
    const raw = rows[0]?.items
    const existing = Array.isArray(raw) ? (raw as unknown[]) : []

    const deduped = existing.filter((entry) => {
      if (!entry || typeof entry !== 'object') {
        return true
      }

      const parsed = entry as Partial<MemoryItem>
      return parsed.text?.trim().toLowerCase() !== note.text.trim().toLowerCase()
    })

    const next = [...deduped, note].slice(-25)

    await sql`
      INSERT INTO bag_memory (user_id, items, updated_at)
      VALUES (${userId}, ${JSON.stringify(next)}::jsonb, now())
      ON CONFLICT (user_id)
      DO UPDATE SET items = EXCLUDED.items, updated_at = now()
    `

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

type OverviewCountsRow = {
  chat_count: string
  image_count: string
  model_counts: Record<string, number> | null
}

export async function getAdminOverview(): Promise<AdminOverview> {
  try {
    const sql = await getSql()
    if (!sql) {
      return {
        storageAvailable: false,
        stats: { chatCount: 0, imageCount: 0, userCount: 0, modelCounts: {} },
        users: [],
      }
    }

    const [counts, userRows] = await Promise.all([
      sql<OverviewCountsRow[]>`
        SELECT
          (SELECT COUNT(*)::int FROM bag_messages)::text AS chat_count,
          (SELECT COUNT(*)::int FROM bag_images)::text AS image_count,
          COALESCE((
            SELECT jsonb_object_agg(model, total)::jsonb
            FROM (
              SELECT model, COUNT(*)::int AS total
              FROM (
                SELECT model FROM bag_messages
                UNION ALL
                SELECT model FROM bag_images
              ) all_models
              GROUP BY model
            ) agg
          ), '{}'::jsonb) AS model_counts
      `,
      sql<{ user_id: string }[]>`
        SELECT DISTINCT user_id
        FROM (
          SELECT user_id FROM bag_users
        ) u
        ORDER BY user_id ASC
      `,
    ])

    const chatCount = Number(counts[0]?.chat_count ?? 0)
    const imageCount = Number(counts[0]?.image_count ?? 0)
    const modelCountsRaw = counts[0]?.model_counts ?? {}

    const modelCounts: Record<string, number> = {}
    for (const [modelName, count] of Object.entries(modelCountsRaw)) {
      modelCounts[modelName] = Number(count)
    }

    const userIds = userRows.map((row) => row.user_id)

    const users = await Promise.all(
      userIds.map(async (currentUserId) => {
        const [agg] = await sql<Array<{
          count: string
          last_time: Date | null
          last_model: string | null
        }>>`
          SELECT
            COUNT(*)::int::text AS count,
            MAX(message_time) AS last_time,
            (SELECT m2.model
             FROM bag_messages m2
             WHERE m2.user_id = ${currentUserId}
             ORDER BY m2.message_time DESC, m2.id DESC
             LIMIT 1) AS last_model
          FROM bag_messages m
          WHERE m.user_id = ${currentUserId}
        `
        const messageCount = Number(agg?.count ?? 0)
        const lastActivityAt = agg?.last_time ? agg.last_time.toISOString() : null
        return {
          userId: currentUserId,
          messageCount,
          lastActivityAt,
          lastModel: agg?.last_model ?? null,
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
        chatCount,
        imageCount,
        userCount: userIds.length,
        modelCounts,
      },
      users,
    }
  } catch {
    return {
      storageAvailable: false,
      stats: { chatCount: 0, imageCount: 0, userCount: 0, modelCounts: {} },
      users: [],
    }
  }
}