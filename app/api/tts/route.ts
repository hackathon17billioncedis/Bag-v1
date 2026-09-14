import { NextResponse } from 'next/server'
import { DEFAULT_TTS_MODEL } from '@/lib/models'
import { NVIDIA_BASE_URL, getNvidiaApiKey } from '@/lib/nvidia'
import { getSessionUserFromRequest } from '@/lib/auth'

type TTSRequest = {
  text?: string
  model?: string
  voice?: string
  language?: string
}

const OPENROUTER_SPEECH_URL = 'https://openrouter.ai/api/v1/audio/speech'

// Free OpenRouter-hosted TTS voices — routed to OpenRouter, not NVIDIA.
const OPENROUTER_TTS_MODEL_IDS = new Set([
  'deepgram/flux-tts:free',
  'fish-audio/s2.1-pro-free:free',
])

function isOpenRouterTtsModel(model: string) {
  return OPENROUTER_TTS_MODEL_IDS.has(model)
}

function shouldFallback(status: number, body: string) {
  if (status === 429 || status === 402 || status >= 500) return true
  const lower = body.toLowerCase()
  return (
    lower.includes('rate') ||
    lower.includes('capacity') ||
    lower.includes('overloaded') ||
    lower.includes('temporarily')
  )
}

async function callNvidiaTts(payload: Record<string, unknown>) {
  const apiKey = getNvidiaApiKey()
  return fetch(`${NVIDIA_BASE_URL}/audio/speech`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

async function callOpenRouterTts(
  payload: Record<string, unknown>,
  siteUrl: string,
  appName: string,
) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured.')
  }
  return fetch(OPENROUTER_SPEECH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': siteUrl,
      'X-Title': appName,
    },
    body: JSON.stringify(payload),
  })
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser) {
    return NextResponse.json(
      { error: 'Please sign in to use text-to-speech.' },
      { status: 401 },
    )
  }

  let body: TTSRequest
  try {
    body = (await request.json()) as TTSRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const text = body.text?.trim()
  if (!text) {
    return NextResponse.json({ error: 'Please provide text to speak.' }, { status: 400 })
  }

  const requestedModel = body.model?.trim() || DEFAULT_TTS_MODEL
  const siteUrl = process.env.SITE_URL ?? process.env.APP_URL ?? 'http://localhost:3000'
  const appName = process.env.APP_NAME ?? 'Bag-v1'

  const nvidiaPayload: Record<string, unknown> = {
    model: requestedModel,
    input: text,
    voice: body.voice || 'default',
    response_format: 'mp3',
  }
  if (body.language) {
    nvidiaPayload.language = body.language
  }

  // OpenRouter-hosted free voices — silent Magpie fallback on retryable failure.
  if (isOpenRouterTtsModel(requestedModel)) {
    // Verified live: deepgram requires a real flux-*-en voice (rejects 'default');
    // fish-audio works when voice is omitted (rejects 'default').
    const openRouterPayload: Record<string, unknown> = {
      model: requestedModel,
      input: text,
      response_format: 'mp3',
    }
    const requestedVoice = body.voice?.trim()
    if (requestedModel.startsWith('deepgram/')) {
      openRouterPayload.voice =
        requestedVoice && requestedVoice !== 'default' ? requestedVoice : 'flux-haley-en'
    } else if (requestedVoice && requestedVoice !== 'default') {
      openRouterPayload.voice = requestedVoice
    }

    let response: Response
    try {
      response = await callOpenRouterTts(openRouterPayload, siteUrl, appName)
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'TTS request failed.' },
        { status: 500 },
      )
    }

    if (!response.ok) {
      const errorText = await response.text()
      if (shouldFallback(response.status, errorText)) {
        // Silent fallback to default NVIDIA voice — voice-input flow only, no UI signal.
        const fallbackPayload: Record<string, unknown> = {
          ...nvidiaPayload,
          model: DEFAULT_TTS_MODEL,
        }
        const fallbackResponse = await callNvidiaTts(fallbackPayload)
        if (!fallbackResponse.ok) {
          const fallbackErr = await fallbackResponse.text()
          return NextResponse.json(
            {
              error: `TTS request failed with status ${fallbackResponse.status}.`,
              details: fallbackErr,
            },
            { status: fallbackResponse.status },
          )
        }
        const audioBuffer = await fallbackResponse.arrayBuffer()
        return new NextResponse(audioBuffer, {
          status: 200,
          headers: {
            'Content-Type': fallbackResponse.headers.get('Content-Type') || 'audio/mpeg',
            'Cache-Control': 'no-cache',
          },
        })
      }

      return NextResponse.json(
        {
          error: `TTS request failed with status ${response.status}.`,
          details: errorText,
        },
        { status: response.status },
      )
    }

    const audioBuffer = await response.arrayBuffer()
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'audio/mpeg',
        'Cache-Control': 'no-cache',
      },
    })
  }

  // NVIDIA-hosted voices (Magpie, Chatterbox) — unchanged path.
  const response = await callNvidiaTts(nvidiaPayload)

  if (!response.ok) {
    const errorText = await response.text()

    if (response.status === 404) {
      return NextResponse.json(
        { error: 'TTS endpoint not available on the current model. Try /chat/completions fallback not implemented.' },
        { status: 502 },
      )
    }

    return NextResponse.json(
      {
        error: `TTS request failed with status ${response.status}.`,
        details: errorText,
      },
      { status: response.status },
    )
  }

  const audioBuffer = await response.arrayBuffer()

  return new NextResponse(audioBuffer, {
    status: 200,
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'audio/mpeg',
      'Cache-Control': 'no-cache',
    },
  })
}
