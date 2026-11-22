import { jwtVerify, SignJWT } from 'jose'
import crypto from 'crypto'
import { neon } from '@neondatabase/serverless'

export type SessionUser = {
  id: string
  email: string
  name: string
  picture: string | null
}

export const AUTH_COOKIE_NAME = 'bag-v1-session'
const SESSION_ISSUER = 'bag-v1'
const SESSION_AUDIENCE = 'bag-v1-web'

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new Error('AUTH_SECRET is not configured.')
  }

  return secret
}

function parseCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) {
    return new Map<string, string>()
  }

  return new Map(
    cookieHeader
      .split(';')
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const separatorIndex = pair.indexOf('=')
        if (separatorIndex === -1) {
          return [pair, '']
        }

        const key = pair.slice(0, separatorIndex).trim()
        const value = pair.slice(separatorIndex + 1).trim()
        return [key, decodeURIComponent(value)]
      }),
  )
}

export function getSessionCookieValue(cookieHeader: string | null) {
  return parseCookieHeader(cookieHeader).get(AUTH_COOKIE_NAME) ?? ''
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({
    email: user.email,
    name: user.name,
    picture: user.picture,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setSubject(user.id)
    .setIssuedAt()
    .sign(new TextEncoder().encode(getAuthSecret()))
}

export function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString()
}

export function hashOTP(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex')
}

type QueryFn = <TResult = Record<string, unknown>[]>(
  strings: TemplateStringsArray,
  ...params: unknown[]
) => Promise<TResult>

let cachedSql: QueryFn | null = null

async function getSql(): Promise<QueryFn | null> {
  if (cachedSql) {
    return cachedSql
  }

  const url = process.env.DATABASE_URL
  if (!url) {
    return null
  }

  try {
    cachedSql = neon(url) as unknown as QueryFn
    return cachedSql
  } catch {
    return null
  }
}

/**
 * Ensure OTP and rate-limit tables exist. Idempotent — safe to call on every
 * cold start of a serverless function.
 */
export async function ensureAuthTables(): Promise<boolean> {
  const sql = await getSql()
  if (!sql) {
    return false
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS bag_otp (
        email TEXT PRIMARY KEY,
        hashed_otp TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS bag_otp_rate (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0,
        window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `
    return true
  } catch {
    return false
  }
}

const OTP_TTL_MINUTES = 10
const OTP_RESEND_COOLDOWN_SECONDS = 60
const OTP_RATE_LIMIT_WINDOW_MINUTES = 60
const OTP_RATE_LIMIT_MAX = 5

function rateLimitKey(email: string, ip: string | null) {
  return `otp:${email}:${ip ?? 'anon'}`
}

export async function storeOTP(email: string, hashedOtp: string): Promise<void> {
  await ensureAuthTables()
  const sql = await getSql()
  if (!sql) {
    return
  }

  const expirationTime = new Date()
  expirationTime.setMinutes(expirationTime.getMinutes() + OTP_TTL_MINUTES)

  await sql`
    INSERT INTO bag_otp (email, hashed_otp, expires_at)
    VALUES (${email.toLowerCase()}, ${hashedOtp}, ${expirationTime.toISOString()})
    ON CONFLICT (email)
    DO UPDATE SET hashed_otp = EXCLUDED.hashed_otp, expires_at = EXCLUDED.expires_at, created_at = now()
  `

  // Cleanup expired OTPs
  await sql`
    DELETE FROM bag_otp WHERE expires_at < now()
  `
}

export async function validateOTP(email: string, otp: string): Promise<boolean> {
  await ensureAuthTables()
  const sql = await getSql()
  if (!sql) {
    return false
  }

  const rows = await sql<{ hashed_otp: string; expires_at: Date }[]>`
    SELECT hashed_otp, expires_at
    FROM bag_otp
    WHERE email = ${email.toLowerCase()}
  `

  const record = rows[0]
  if (!record) {
    return false
  }

  if (record.expires_at < new Date()) {
    await sql`DELETE FROM bag_otp WHERE email = ${email.toLowerCase()}`
    return false
  }

  const isValid = record.hashed_otp === hashOTP(otp)

  if (isValid) {
    await sql`DELETE FROM bag_otp WHERE email = ${email.toLowerCase()}`
  }

  return isValid
}

/**
 * Check and increment the per-email/IP rate limiter for OTP sends.
 * Returns { allowed, remaining, resetAt }.
 */
export async function checkOtpRateLimit(email: string, ip: string | null): Promise<{
  allowed: boolean
  remaining: number
  resetAt: Date
}> {
  await ensureAuthTables()
  const sql = await getSql()
  if (!sql) {
    // If DB is unavailable, fail open but still record nothing
    return { allowed: true, remaining: OTP_RATE_LIMIT_MAX, resetAt: new Date(Date.now() + OTP_RATE_LIMIT_WINDOW_MINUTES * 60000) }
  }

  const key = rateLimitKey(email, ip)
  const now = new Date()
  const windowStart = new Date(now.getTime() - OTP_RATE_LIMIT_WINDOW_MINUTES * 60000)

  // Clean old windows
  await sql`
    DELETE FROM bag_otp_rate WHERE window_start < ${windowStart.toISOString()}
  `

  const rows = await sql<{ count: string; window_start: Date }[]>`
    SELECT count, window_start
    FROM bag_otp_rate
    WHERE key = ${key}
  `

  const record = rows[0]
  const inWindow = record && record.window_start >= windowStart

  if (!inWindow) {
    // Start a new window
    await sql`
      INSERT INTO bag_otp_rate (key, count, window_start, updated_at)
      VALUES (${key}, 1, ${now.toISOString()}, ${now.toISOString()})
      ON CONFLICT (key)
      DO UPDATE SET count = 1, window_start = ${now.toISOString()}, updated_at = ${now.toISOString()}
    `
    return { allowed: true, remaining: OTP_RATE_LIMIT_MAX - 1, resetAt: new Date(now.getTime() + OTP_RATE_LIMIT_WINDOW_MINUTES * 60000) }
  }

  const count = Number(record.count ?? 0)
  if (count >= OTP_RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetAt: new Date(record.window_start.getTime() + OTP_RATE_LIMIT_WINDOW_MINUTES * 60000) }
  }

  await sql`
    UPDATE bag_otp_rate
    SET count = count + 1, updated_at = ${now.toISOString()}
    WHERE key = ${key}
  `

  return { allowed: true, remaining: OTP_RATE_LIMIT_MAX - count - 1, resetAt: new Date(record.window_start.getTime() + OTP_RATE_LIMIT_WINDOW_MINUTES * 60000) }
}

/**
 * Check if an email can resend an OTP (cooldown enforcement).
 */
export async function checkOtpResendCooldown(email: string): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  await ensureAuthTables()
  const sql = await getSql()
  if (!sql) {
    return { allowed: true, retryAfterSeconds: 0 }
  }

  const rows = await sql<{ created_at: Date }[]>`
    SELECT created_at
    FROM bag_otp
    WHERE email = ${email.toLowerCase()}
    ORDER BY created_at DESC
    LIMIT 1
  `

  const record = rows[0]
  if (!record) {
    return { allowed: true, retryAfterSeconds: 0 }
  }

  const elapsed = Date.now() - record.created_at.getTime()
  const cooldownMs = OTP_RESEND_COOLDOWN_SECONDS * 1000

  if (elapsed < cooldownMs) {
    return { allowed: false, retryAfterSeconds: Math.ceil((cooldownMs - elapsed) / 1000) }
  }

  return { allowed: true, retryAfterSeconds: 0 }
}

export async function getSessionUserFromRequest(request: Request) {
  const token = getSessionCookieValue(request.headers.get('cookie'))
  if (!token) {
    return null
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(getAuthSecret()), {
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    })

    const id = typeof payload.sub === 'string' ? payload.sub : ''
    const email = typeof payload.email === 'string' ? payload.email : ''
    const name = typeof payload.name === 'string' ? payload.name : email
    const picture = typeof payload.picture === 'string' ? payload.picture : null

    if (!id || !email) {
      return null
    }

    return { id, email, name, picture }
  } catch {
    return null
  }
}
