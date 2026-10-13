import { NextResponse } from 'next/server'
import { DEFAULT_TTS_MODEL } from '@/lib/models'
import { getSessionUserFromRequest } from '@/lib/auth'

type TTSRequest = {
  text?: string
  model?: string
  voice?: string
  language?: string
}

const OPENROUTER_SPEECH_URL = 'https://openrouter.ai/api/v1/audio/speech'
const ELEVENLABS_TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech'
const ELEVENLABS_MODEL_ID = 'eleven_flash_v2_5'
const ELEVENLABS_PREFIX = 'elevenlabs/'

// Verified live: fish-audio works on the connected OpenRouter account and is
// the guaranteed OpenRouter fallback. deepgram/flux-tts:free is deliberately
// NOT used as a fallback — provider routing for it varies per OpenRouter
// account and it 404s ("No endpoints found") on the current one.
const FALLBACK_OPENROUTER_MODEL = 'fish-audio/s2.1-pro-free:free'
// Verified live: Adam is a real voice on the connected ElevenLabs account, and
// ElevenLabs routing is independent of the OpenRouter account entirely.
const FALLBACK_ELEVENLABS_VOICE = 'pNInz6obpgDQGcFmaJgB'

// Free OpenRouter-hosted TTS voices — routed to OpenRouter, not NVIDIA.
const OPENROUTER_TTS_MODEL_IDS = new Set([
  'deepgram/flux-tts:free',
  'fish-audio/s2.1-pro-free:free',
])

function isOpenRouterTtsModel(model: string) {
  return OPENROUTER_TTS_MODEL_IDS.has(model)
}

function getElevenLabsVoiceId(model: string) {
  return model.startsWith(ELEVENLABS_PREFIX)
    ? model.slice(ELEVENLABS_PREFIX.length).trim()
    : null
}

async function callElevenLabsTts(voiceId: string, text: string) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not configured.')
  }
  return fetch(`${ELEVENLABS_TTS_URL}/${encodeURIComponent(voiceId)}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: ELEVENLABS_MODEL_ID,
    }),
  })
}

function audioResponse(response: Response) {
  return response.arrayBuffer().then(
    (audioBuffer) =>
      new NextResponse(audioBuffer, {
        status: 200,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'audio/mpeg',
          'Cache-Control': 'no-cache',
        },
      }),
  )
}

async function callOpenRouterTts(
  model: string,
  text: string,
  voice: string | undefined,
  siteUrl: string,
  appName: string,
) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return null
  }

  // Verified live: deepgram rejects 'default' and needs a real flux voice;
  // fish-audio works with the voice omitted.
  const payload: Record<string, unknown> = {
    model,
    input: text,
    response_format: 'mp3',
  }
  if (model.startsWith('deepgram/')) {
    payload.voice = voice && voice !== 'default' ? voice : 'flux-haley-en'
  } else if (voice && voice !== 'default') {
    payload.voice = voice
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

type Attempt = {
  label: string
  run: () => Promise<Response | null>
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
  const requestedVoice = body.voice?.trim()

  const elevenVoiceId = getElevenLabsVoiceId(requestedModel)

  // Build an ordered attempt list. NVIDIA's public endpoint does not serve
  // /audio/speech (it 404s), so it is never used — every path ends on a
  // provider verified to return real MP3 audio.
  const attempts: Attempt[] = []

  if (elevenVoiceId) {
    attempts.push({
      label: `elevenlabs:${elevenVoiceId}`,
      run: () => callElevenLabsTts(elevenVoiceId, text),
    })
  } else if (isOpenRouterTtsModel(requestedModel)) {
    attempts.push({
      label: requestedModel,
      run: () => callOpenRouterTts(requestedModel, text, requestedVoice, siteUrl, appName),
    })
  }

  // Guaranteed working fallbacks, tried in order. ElevenLabs last because its
  // routing cannot be affected by OpenRouter account changes.
  if (requestedModel !== FALLBACK_OPENROUTER_MODEL) {
    attempts.push({
      label: FALLBACK_OPENROUTER_MODEL,
      run: () => callOpenRouterTts(FALLBACK_OPENROUTER_MODEL, text, requestedVoice, siteUrl, appName),
    })
  }
  if (!elevenVoiceId || elevenVoiceId !== FALLBACK_ELEVENLABS_VOICE) {
    if (process.env.ELEVENLABS_API_KEY) {
      attempts.push({
        label: `elevenlabs:${FALLBACK_ELEVENLABS_VOICE}`,
        run: () => callElevenLabsTts(FALLBACK_ELEVENLABS_VOICE, text),
      })
    }
  }
  if (!elevenVoiceId) {
    attempts.push({
      label: `${FALLBACK_OPENROUTER_MODEL}:retry`,
      run: () => callOpenRouterTts(FALLBACK_OPENROUTER_MODEL, text, requestedVoice, siteUrl, appName),
    })
  }

  const failures: string[] = []

  for (const attempt of attempts) {
    let response: Response | null
    try {
      response = await attempt.run()
    } catch (error) {
      failures.push(
        `${attempt.label}: ${error instanceof Error ? error.message : 'request failed'}`,
      )
      continue
    }

    if (!response) {
      failures.push(`${attempt.label}: provider not configured`)
      continue
    }

    if (response.ok) {
      return audioResponse(response)
    }

    const detail = await response.text()
    failures.push(`${attempt.label} (${response.status}): ${detail.slice(0, 200)}`)
  }

  return NextResponse.json(
    { error: 'Text-to-speech failed on every provider.', details: failures },
    { status: 502 },
  )
}
