import { NextResponse } from 'next/server'
import { getSessionUserFromRequest } from '@/lib/auth'

const GROQ_TRANSCRIPTIONS_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const OPENROUTER_TRANSCRIPTIONS_URL = 'https://openrouter.ai/api/v1/audio/transcriptions'
const GROQ_STT_MODEL = 'whisper-large-v3-turbo'

// All three are the cheapest paid tier on OpenRouter (~$0.012/hour measured),
// and act as a safety net when Groq is unavailable or rate-limited.
const OPENROUTER_STT_CHAIN = [
  'openai/whisper-large-v3-turbo',
  'qwen/qwen3-asr-0.6b',
  'nvidia/nemotron-3.5-asr-streaming-multilingual-0.6b',
]

const MAX_AUDIO_BYTES = 25 * 1024 * 1024

type SttFailure = {
  provider: string
  status: number
  detail: string
}

function cleanTranscript(value: string) {
  return value
    // Some providers prefix speaker tags, e.g. "<|speaker:0|> text".
    .replace(/<\|[^|]*\|>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isRetryable(status: number) {
  return status === 429 || status === 402 || status >= 500
}

function toBase64(buffer: ArrayBuffer) {
  return Buffer.from(new Uint8Array(buffer)).toString('base64')
}

// Convert arbitrary browser audio (webm/opus, mp4, ogg...) into a 16 kHz mono
// 16-bit PCM WAV, which is the format OpenRouter's transcription models expect.
async function normalizeToWav16k(file: File): Promise<ArrayBuffer> {
  const raw = await file.arrayBuffer()
  const audioWindow = globalThis as typeof globalThis & {
    AudioContext?: new (options?: { sampleRate?: number }) => AudioContext
  }
  const Ctx = audioWindow.AudioContext
  if (!Ctx) {
    throw new Error('AudioContext is unavailable in this runtime.')
  }

  // Decode at the source rate first, then resample while encoding.
  const decodeCtx = new Ctx()
  let decoded: AudioBuffer
  try {
    decoded = await decodeCtx.decodeAudioData(raw.slice(0))
  } finally {
    void decodeCtx.close()
  }

  const targetRate = 16000
  const frameCount = Math.max(1, Math.ceil((decoded.duration * targetRate) || 1))
  const offlineCtx = new Ctx()
  const offline = new OfflineAudioContext(1, frameCount, targetRate)

  const source = offlineCtx.createBufferSource()
  source.buffer = decoded
  // Mono downmix by panning the input equally to a single output channel.
  source.connect(offline.destination)
  source.start(0)

  const rendered = await offline.startRendering()
  const channel = rendered.getChannelData(0)

  const bytesPerSample = 2
  const dataSize = channel.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i))
    }
  }

  writeAscii(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(8, 'WAVE')
  writeAscii(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM header size
  view.setUint16(20, 1, true) // format = PCM
  view.setUint16(22, 1, true) // channels = mono
  view.setUint32(24, targetRate, true)
  view.setUint32(28, targetRate * bytesPerSample, true) // byte rate
  view.setUint16(32, bytesPerSample, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeAscii(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < channel.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, channel[i]))
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
    offset += bytesPerSample
  }

  return buffer
}

async function transcribeWithGroq(file: File) {
  const apiKey = process.env.GROQ_API_KEY?.trim()
  if (!apiKey) {
    return { ok: false as const, failure: null }
  }

  // Groq accepts webm/opus directly, so send the original bytes untouched.
  const form = new FormData()
  form.set('file', file, file.name || 'voice-turn.webm')
  form.set('model', GROQ_STT_MODEL)
  form.set('response_format', 'json')

  const response = await fetch(GROQ_TRANSCRIPTIONS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })

  if (!response.ok) {
    const detail = await response.text()
    return {
      ok: false as const,
      failure: { provider: 'groq', status: response.status, detail } satisfies SttFailure,
    }
  }

  const payload = (await response.json()) as { text?: string }
  const text = cleanTranscript(payload.text ?? '')
  if (!text) {
    return {
      ok: false as const,
      failure: { provider: 'groq', status: 502, detail: 'Empty transcript.' } satisfies SttFailure,
    }
  }

  return { ok: true as const, text, provider: 'groq' }
}

async function transcribeWithOpenRouter(model: string, wav: ArrayBuffer) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) {
    return { ok: false as const, failure: null }
  }

  const siteUrl = process.env.SITE_URL ?? process.env.APP_URL ?? 'http://localhost:3000'
  const appName = process.env.APP_NAME ?? 'Bag-v1'

  const response = await fetch(OPENROUTER_TRANSCRIPTIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': siteUrl,
      'X-Title': appName,
    },
    // Documented shape: base64 WAV under input_audio.
    body: JSON.stringify({
      model,
      input_audio: { data: toBase64(wav), format: 'wav' },
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    return {
      ok: false as const,
      failure: { provider: model, status: response.status, detail } satisfies SttFailure,
    }
  }

  const contentType = response.headers.get('Content-Type') || ''
  let text = ''
  if (contentType.includes('application/json')) {
    const payload = (await response.json()) as { text?: string }
    text = cleanTranscript(payload.text ?? '')
  } else {
    text = cleanTranscript(await response.text())
  }

  if (!text) {
    return {
      ok: false as const,
      failure: { provider: model, status: 502, detail: 'Empty transcript.' } satisfies SttFailure,
    }
  }

  return { ok: true as const, text, provider: model }
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser) {
    return NextResponse.json({ error: 'Please sign in to use voice input.' }, { status: 401 })
  }

  const hasGroq = Boolean(process.env.GROQ_API_KEY?.trim())
  const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY?.trim())
  if (!hasGroq && !hasOpenRouter) {
    return NextResponse.json(
      { error: 'No speech-to-text provider is configured.' },
      { status: 500 },
    )
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
  if (file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: 'Audio file too large (max 25MB).' }, { status: 400 })
  }

  const audioFile: File = file
  const failures: SttFailure[] = []

  // 1) Groq free tier — primary. Handles raw webm, costs $0.
  if (hasGroq) {
    try {
      const result = await transcribeWithGroq(audioFile)
      if (result.ok) {
        return NextResponse.json({ text: result.text, provider: result.provider })
      }
      if (result.failure) {
        failures.push(result.failure)
      }
    } catch (error) {
      failures.push({
        provider: 'groq',
        status: 500,
        detail: error instanceof Error ? error.message : 'Request failed.',
      })
    }
  }

  // 2) OpenRouter paid chain — needs normalized 16 kHz mono WAV.
  if (hasOpenRouter) {
    let wav: ArrayBuffer | null = null
    try {
      wav = await normalizeToWav16k(audioFile)
    } catch (error) {
      failures.push({
        provider: 'wav-normalizer',
        status: 500,
        detail: error instanceof Error ? error.message : 'Could not normalize audio.',
      })
    }

    if (wav) {
      for (const model of OPENROUTER_STT_CHAIN) {
        try {
          const result = await transcribeWithOpenRouter(model, wav)
          if (result.ok) {
            return NextResponse.json({ text: result.text, provider: result.provider })
          }
          if (result.failure) {
            failures.push(result.failure)
            // Non-retryable (e.g. bad audio for this provider) still tries the next model.
          }
        } catch (error) {
          failures.push({
            provider: model,
            status: 500,
            detail: error instanceof Error ? error.message : 'Request failed.',
          })
        }
      }
    }
  }

  const lastFailure = failures.at(-1)
  const retryable = lastFailure ? isRetryable(lastFailure.status) : false
  const status = retryable ? 503 : 502

  return NextResponse.json(
    {
      error: 'Transcription failed.',
      // Surfaced so the Voice Room can explain itself instead of a bare failure.
      details: failures.map((item) => `${item.provider} (${item.status}): ${item.detail.slice(0, 300)}`),
    },
    { status },
  )
}
