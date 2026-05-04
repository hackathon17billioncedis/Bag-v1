export function getApiBaseUrl() {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.SITE_URL ?? process.env.APP_URL ?? ''
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL ?? ''
}

export function apiUrl(path: string) {
  const baseUrl = getApiBaseUrl().replace(/\/$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath
}
