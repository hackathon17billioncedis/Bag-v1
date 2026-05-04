import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose'

export type SessionUser = {
  id: string
  email: string
  name: string
  picture: string | null
}

export const AUTH_COOKIE_NAME = 'bag-v1-session'
const SESSION_ISSUER = 'bag-v1'
const SESSION_AUDIENCE = 'bag-v1-web'
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new Error('AUTH_SECRET is not configured.')
  }

  return secret
}

function getGoogleClientId() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  if (!clientId) {
    throw new Error('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured.')
  }

  return clientId
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

export async function verifyGoogleCredential(credential: string): Promise<SessionUser> {
  const { payload } = await jwtVerify(credential, GOOGLE_JWKS, {
    audience: getGoogleClientId(),
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
  })

  const id = typeof payload.sub === 'string' ? payload.sub : ''
  const email = typeof payload.email === 'string' ? payload.email : ''
  const name = typeof payload.name === 'string' && payload.name.trim().length > 0 ? payload.name : email
  const picture = typeof payload.picture === 'string' ? payload.picture : null

  if (!id || !email) {
    throw new Error('Google account did not include the required profile details.')
  }

  return { id, email, name, picture }
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
