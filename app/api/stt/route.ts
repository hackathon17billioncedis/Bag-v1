import { NextResponse } from 'next/server'
import { getSessionUserFromRequest } from '@/lib/auth'
import { DEFAULT_STT_MODEL, FALLBACK_STT_MODEL } from '@/lib/models'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/audio/transcriptions'

function shouldFallback(status: number, body: string) {
  if (status === 429 || status === 402 || status >= 500) return true
  const lower = body.toLowerCase()
  return lower.includes('rate') || lower.includes('capacity') || lower.includes('overloaded') || lower.includes('temporarily')
}

async function callOpenRouterTranscription(model: string, file: File, siteUrl: string, appName: string, apiKey: string) {
  const form = new FormData()
  // OpenRouter expects field `file` (OpenAI-compatible) + `model`
  form.set('file', file, file.name || 'audio.webm')
  form.set('model', model)

  return fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': siteUrl,
      'X-Title': appName,
    },
    body: form,
  })
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser) {
    return NextResponse.json({ error: 'Please sign in to use voice input.' }, { status: 401 })
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENROUTER_API_KEY is not configured.' }, { status: 500 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 })
  }

  const file = (form.get('file') as File | null) || (form.get('audio') as File | null) || (form.get('data') as File | null)
  if (!file || !(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: 'Please provide an audio file.' }, { status: 400 })
  }

  // normalize to File for OpenRouter
  const audioFile =
    file instanceof File ? file : new File([file as Blob], (file as File).name || 'audio.webm', { type: (file as Blob).type || 'audio/webm' })

  if (audioFile.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: 'Audio file too large (max 25MB).' }, { status: 400 })
  }

  const siteUrl = process.env.SITE_URL ?? process.env.APP_URL ?? 'http://localhost:3000'
  const appName = process.env.APP_NAME ?? 'Bag-v1'
  const primaryModel = (form.get('model') as string | null)?.trim() || DEFAULT_STT_MODEL
  const fallbackModel = FALLBACK_STT_MODEL

  // 1) try primary
  let response = await callOpenRouterTranscription(primaryModel, audioFile, siteUrl, appName, apiKey)

  // 2) silent automatic fallback — voice-input flow only, no UI signal
  if (!response.ok) {
    const errText = await response.text()
    if (shouldFallback(response.status, errText)) {
      // retry silently with fallback model — need fresh File handle
      const retryFile = new File([await audioFile.arrayBuffer()], audioFile.name, { type: audioFile.type })
      response = await callOpenRouterTranscription(fallbackModel, retryFile, siteUrl, appName, apiKey)
      if (!response.ok) {
        const fallbackErr = await response.text()
        return NextResponse.json(
          { error: `Transcription failed.`, details: fallbackErr },
          { status: response.status },
        )
      }
    } else {
      return NextResponse.json({ error: `Transcription failed.`, details: errText }, { status: response.status })
    }
  }

  // OpenRouter returns { text: string, ... } for transcriptions
  const contentType = response.headers.get('Content-Type') || ''
  if (contentType.includes('application/json')) {
    const data = (await response.json()) as { text?: string }
    const text = (data.text ?? '').trim()
    if (!text) {
      return NextResponse.json({ error: 'Transcription returned empty text.' }, { status: 502 })
    }
    return NextResponse.json({ text })
  }

  // fallback: plain text
  const text = (await response.text()).trim()
  if (!text) {
    return NextResponse.json({ error: 'Transcription returned empty text.' }, { status: 502 })
  }
  return NextResponse.json({ text })
}
