import { jwtVerify, SignJWT } from 'jose'
import crypto from 'crypto'

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
    .setExpirationTime('30d')
    .sign(new TextEncoder().encode(getAuthSecret()))
}

export function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString()
}

export function hashOTP(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex')
}

const otpCache = new Map<string, { hashedOtp: string; expiresAt: Date }>()

export function storeOTP(email: string, hashedOtp: string): void {
  const expirationTime = new Date()
  expirationTime.setMinutes(expirationTime.getMinutes() + 10)
  
  otpCache.set(email, {
    hashedOtp,
    expiresAt: expirationTime
  })
  
  setTimeout(() => {
    otpCache.forEach((value, key) => {
      if (value.expiresAt < new Date()) {
        otpCache.delete(key)
      }
    })
  }, 600000)
}

export function validateOTP(email: string, otp: string): boolean {
  const record = otpCache.get(email)
  
  if (!record) {
    return false
  }
  
  if (record.expiresAt < new Date()) {
    otpCache.delete(email)
    return false
  }
  
  const isValid = record.hashedOtp === hashOTP(otp)
  
  if (isValid) {
    otpCache.delete(email)
  }
  
  return isValid
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
