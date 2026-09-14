export type ModelOption = {
  id: string
  label: string
  category: string
  description: string
  bestFor: string
}

const MODEL_ID_ALIASES: Record<string, string> = {
  'meta-llama/llama-3.1-8b-instruct:free': 'meta-llama/llama-3.1-8b-instruct',
  'google/gemma-4-26b-a4b-it': 'google/gemma-4-26b-a4b-it:free',
  'google/gemma-4-26b-a4b-it:free': 'google/gemma-4-26b-a4b-it:free',
  'google/gemma-4-31b-it': 'google/gemma-4-31b-it:free',
  'google/gemma-4-31b-it:free': 'google/gemma-4-31b-it:free',
  'openai/gpt-oss-20b': 'openai/gpt-oss-20b:free',
  'openai/gpt-oss-20b:free': 'openai/gpt-oss-20b:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning': 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'nvidia/nemotron-3-super-120b-a12b': 'nvidia/nemotron-3-super-120b-a12b:free',
  'nvidia/nemotron-3-ultra-550b-a55b': 'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3.5-lightning': 'nvidia/nemotron-3.5-lightning:free',
  'nvidia/nemotron-3.5-lightning:free': 'nvidia/nemotron-3.5-lightning:free',
}

export const APP_NAME = 'Bag-v1'
export const DEFAULT_MODEL =
  normalizeModelId(
    process.env.OPENROUTER_DEFAULT_MODEL ??
      process.env.OPENROUTER_MODEL ??
      'meta-llama/llama-3.1-8b-instruct',
  )
export const DEFAULT_TTS_MODEL = 'nvidia/magpie-tts-multilingual'
export const DEFAULT_STT_MODEL = 'openai/whisper-large-v3'
export const FALLBACK_STT_MODEL = 'qwen/qwen3-asr-0.6b'

export const SYSTEM_PROMPT = `You are ${APP_NAME}, a warm, helpful AI assistant.
Think briefly before answering, then respond in a calm, professional, and natural way.
Always present yourself as Bag-v1, no matter which underlying model is selected.
Keep answers direct, useful, and well-structured.
If the user asks for code or product help, give clear steps and mention tradeoffs briefly.
Avoid overexplaining unless the user asks for detail.`

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'stealth/ox-alpha',
    label: 'Stealth OX Alpha',
    category: 'OpenRouter',
    description: 'Stealth OX Alpha model via OpenRouter.',
    bestFor: 'Advanced reasoning & coding',
  },
  {
    id: 'meta-llama/llama-3.1-8b-instruct',
    label: 'Llama 3.1 8B',
    category: 'Llama',
    description: 'Strong general-purpose model.',
    bestFor: 'Balanced everyday chat',
  },
  {
    id: 'google/gemma-4-26b-a4b-it:free',
    label: 'Gemma 4 26B A4B (Free)',
    category: 'Gemma',
    description: 'Free efficient Gemma via OpenRouter — verified.',
    bestFor: 'General reasoning',
  },
  {
    id: 'google/gemma-4-31b-it:free',
    label: 'Gemma 4 31B (Free)',
    category: 'Gemma',
    description: 'Free larger Gemma via OpenRouter — verified.',
    bestFor: 'Stronger reasoning',
  },
  {
    id: 'inclusionai/ling-3.0-flash-fin:free',
    label: 'Ling 3.0 Flash Fin (Free)',
    category: 'OpenRouter',
    description: 'Free Ling Flash Fin via OpenRouter — verified.',
    bestFor: 'Finance & general chat',
  },
  {
    id: 'nex-agi/nex-n2.5-mini:free',
    label: 'Nex N2.5 Mini (Free)',
    category: 'OpenRouter',
    description: 'Free Nex Mini via OpenRouter — verified.',
    bestFor: 'Fast general chat',
  },
  {
    id: 'nex-agi/nex-n2.5-pro:free',
    label: 'Nex N2.5 Pro (Free)',
    category: 'OpenRouter',
    description: 'Free Nex Pro via OpenRouter — verified.',
    bestFor: 'Higher-quality chat',
  },
  {
    id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    label: 'Nemotron 3 Nano Omni (Free)',
    category: 'NVIDIA',
    description: 'Free Nemotron Nano reasoning via OpenRouter — verified.',
    bestFor: 'Reasoning & coding',
  },
  {
    id: 'nvidia/nemotron-3-super-120b-a12b:free',
    label: 'Nemotron 3 Super 120B (Free)',
    category: 'NVIDIA',
    description: 'Free Nemotron Super via OpenRouter — verified.',
    bestFor: 'Agentic reasoning',
  },
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    label: 'Nemotron 3 Ultra 550B (Free)',
    category: 'NVIDIA',
    description: 'Free Nemotron Ultra 1M ctx via OpenRouter — verified.',
    bestFor: 'Maximum reasoning',
  },
  {
    id: 'nvidia/nemotron-3.5-lightning:free',
    label: 'Nemotron 3.5 Lightning (Free)',
    category: 'NVIDIA',
    description: 'Free fast Nemotron via OpenRouter — verified.',
    bestFor: 'Fast general chat',
  },
  {
    id: 'mistralai/mistral-nemo',
    label: 'Mistral Nemo',
    category: 'Mistral',
    description: 'Strong all-rounder from Mistral.',
    bestFor: 'Reasoning and chat',
  },
  {
    id: 'mistralai/mistral-small-24b-instruct-2501',
    label: 'Mistral Small 24B 2501',
    category: 'Mistral',
    description: 'Useful for balanced quality.',
    bestFor: 'Balanced responses',
  },
  {
    id: 'mistralai/mistral-small-3.2-24b-instruct',
    label: 'Mistral Small 3.2 24B',
    category: 'Mistral',
    description: 'Newer Mistral instruction model.',
    bestFor: 'General assistant work',
  },
  {
    id: 'qwen/qwen-2.5-7b-instruct',
    label: 'Qwen 2.5 7B',
    category: 'Qwen',
    description: 'Reliable smaller Qwen model.',
    bestFor: 'Fast general chat',
  },
  {
    id: 'qwen/qwen3-235b-a22b-2507',
    label: 'Qwen3 235B A22B 2507',
    category: 'Qwen',
    description: 'Very large Qwen option.',
    bestFor: 'Maximum capability',
  },
  {
    id: 'nvidia/nemotron-3-super-120b-a12b',
    label: 'Nemotron-3 Super 120B',
    category: 'NVIDIA',
    description: 'NVIDIA flagship MoE with 1M context.',
    bestFor: 'Agentic reasoning & coding',
  },
  {
    id: 'deepseek-ai/deepseek-v3.2',
    label: 'DeepSeek V3.2',
    category: 'NVIDIA',
    description: 'State-of-the-art 685B reasoning LLM.',
    bestFor: 'Reasoning & coding',
  },
  {
    id: 'minimaxai/minimax-m2.7',
    label: 'MiniMax M2.7',
    category: 'NVIDIA',
    description: '230B MoE strong on coding & reasoning.',
    bestFor: 'Coding & office tasks',
  },
  {
    id: 'z-ai/glm-5.1',
    label: 'GLM 5.1',
    category: 'NVIDIA',
    description: 'Zhipu flagship, agentic & multilingual.',
    bestFor: 'Agentic tasks & multilingual chat',
  },
  {
    id: 'moonshotai/kimi-k2.5',
    label: 'Kimi K2.5',
    category: 'NVIDIA',
    description: '1T MoE with 100K context.',
    bestFor: 'Long-context reasoning',
  },
  {
    id: 'meta/llama-4-maverick',
    label: 'Llama 4 Maverick',
    category: 'NVIDIA',
    description: 'Meta latest open multimodal model.',
    bestFor: 'General-purpose chat & reasoning',
  },
  {
    id: 'google/gemma-4-31b-it',
    label: 'Gemma 4 31B IT',
    category: 'NVIDIA',
    description: 'Google Gemma 4, agentic & efficient.',
    bestFor: 'Agentic tasks & general chat',
  },
]

export const TTS_MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'nvidia/magpie-tts-multilingual',
    label: 'Magpie TTS Multilingual',
    category: 'TTS',
    description: 'NVIDIA multilingual text-to-speech.',
    bestFor: 'Natural speech in multiple languages',
  },
  {
    id: 'resembleai/chatterbox-multilingual-tts',
    label: 'Chatterbox TTS',
    category: 'TTS',
    description: '23-language TTS with voice cloning.',
    bestFor: 'Expressive multilingual speech',
  },
  {
    id: 'deepgram/flux-tts:free',
    label: 'Flux TTS (Free)',
    category: 'TTS',
    description: 'Free conversation-aware Deepgram voice via OpenRouter.',
    bestFor: 'Conversational voice output',
  },
  {
    id: 'fish-audio/s2.1-pro-free:free',
    label: 'S2.1 Pro Free (Free)',
    category: 'TTS',
    description: 'Free Fish Audio multilingual voice via OpenRouter.',
    bestFor: 'Multilingual voice output',
  },
  {
    id: 'elevenlabs/hpp4J3VqNfWAUOO0d1Us',
    label: 'Bella (ElevenLabs)',
    category: 'TTS',
    description: 'Professional, bright, warm. Middle-aged female, American.',
    bestFor: 'Warm professional narration',
  },
  {
    id: 'elevenlabs/CwhRBWXzGAHq8TQ4Fs17',
    label: 'Roger (ElevenLabs)',
    category: 'TTS',
    description: 'Laid-back, casual, resonant. Middle-aged male, American.',
    bestFor: 'Casual conversational voice',
  },
  {
    id: 'elevenlabs/EXAVITQu4vr4xnSDxMaL',
    label: 'Sarah (ElevenLabs)',
    category: 'TTS',
    description: 'Mature, reassuring, confident. Young female, American.',
    bestFor: 'Reassuring assistant voice',
  },
  {
    id: 'elevenlabs/FGY2WhTYpPnrIDTdsKH5',
    label: 'Laura (ElevenLabs)',
    category: 'TTS',
    description: 'Enthusiast, quirky attitude. Young female, American.',
    bestFor: 'Playful energetic voice',
  },
  {
    id: 'elevenlabs/IKne3meq5aSn9XLyUdCD',
    label: 'Charlie (ElevenLabs)',
    category: 'TTS',
    description: 'Deep, confident, energetic. Young male, Australian.',
    bestFor: 'Bold youthful voice',
  },
  {
    id: 'elevenlabs/JBFqnCBsd6RMkjVDRZzb',
    label: 'George (ElevenLabs)',
    category: 'TTS',
    description: 'Warm, captivating storyteller. Middle-aged male, British.',
    bestFor: 'Storytelling voice',
  },
  {
    id: 'elevenlabs/N2lVS1w4EtoT3dr4eOWO',
    label: 'Callum (ElevenLabs)',
    category: 'TTS',
    description: 'Husky trickster. Middle-aged male, American.',
    bestFor: 'Character voice',
  },
  {
    id: 'elevenlabs/SAz9YHcvj6GT2YYXdXww',
    label: 'River (ElevenLabs)',
    category: 'TTS',
    description: 'Relaxed, neutral, informative. Middle-aged, American.',
    bestFor: 'Neutral informative voice',
  },
  {
    id: 'elevenlabs/SOYHLrjzK2X1ezoPC6cr',
    label: 'Harry (ElevenLabs)',
    category: 'TTS',
    description: 'Fierce warrior. Young male, American.',
    bestFor: 'Dramatic voice',
  },
  {
    id: 'elevenlabs/TX3LPaxmHKxFdv7VOQHJ',
    label: 'Liam (ElevenLabs)',
    category: 'TTS',
    description: 'Energetic, social media creator. Young male, American.',
    bestFor: 'Upbeat creator voice',
  },
  {
    id: 'elevenlabs/Xb7hH8MSUJpSbSDYk0k2',
    label: 'Alice (ElevenLabs)',
    category: 'TTS',
    description: 'Clear, engaging educator. Middle-aged female, British.',
    bestFor: 'Educational voice',
  },
  {
    id: 'elevenlabs/XrExE9yKIg1WjnnlVkGX',
    label: 'Matilda (ElevenLabs)',
    category: 'TTS',
    description: 'Knowledgeable, professional. Middle-aged female, American.',
    bestFor: 'Professional voice',
  },
  {
    id: 'elevenlabs/bIHbv24MWmeRgasZH58o',
    label: 'Will (ElevenLabs)',
    category: 'TTS',
    description: 'Relaxed optimist. Young male, American.',
    bestFor: 'Friendly casual voice',
  },
  {
    id: 'elevenlabs/cgSgspJ2msm6clMCkdW9',
    label: 'Jessica (ElevenLabs)',
    category: 'TTS',
    description: 'Playful, bright, warm. Young female, American.',
    bestFor: 'Cheerful voice',
  },
  {
    id: 'elevenlabs/cjVigY5qzO86Huf0OWal',
    label: 'Eric (ElevenLabs)',
    category: 'TTS',
    description: 'Smooth, trustworthy. Middle-aged male, American.',
    bestFor: 'Trustworthy narrator',
  },
  {
    id: 'elevenlabs/iP95p4xoKVk53GoZ742B',
    label: 'Chris (ElevenLabs)',
    category: 'TTS',
    description: 'Charming, down-to-earth. Middle-aged male, American.',
    bestFor: 'Down-to-earth voice',
  },
  {
    id: 'elevenlabs/nPczCjzI2devNBz1zQrb',
    label: 'Brian (ElevenLabs)',
    category: 'TTS',
    description: 'Deep, resonant and comforting. Middle-aged male, American.',
    bestFor: 'Deep comforting voice',
  },
  {
    id: 'elevenlabs/onwK4e9ZLuTAKqWW03F9',
    label: 'Daniel (ElevenLabs)',
    category: 'TTS',
    description: 'Steady broadcaster. Middle-aged male, British.',
    bestFor: 'Broadcast voice',
  },
  {
    id: 'elevenlabs/pFZP5JQG7iQjIQuC4Bku',
    label: 'Lily (ElevenLabs)',
    category: 'TTS',
    description: 'Velvety actress. Middle-aged female, British.',
    bestFor: 'Elegant voice',
  },
  {
    id: 'elevenlabs/pNInz6obpgDQGcFmaJgB',
    label: 'Adam (ElevenLabs)',
    category: 'TTS',
    description: 'Dominant, firm. Middle-aged male, American.',
    bestFor: 'Authoritative voice',
  },
  {
    id: 'elevenlabs/pqHfZKP75CvOlQylNhV4',
    label: 'Bill (ElevenLabs)',
    category: 'TTS',
    description: 'Wise, mature, balanced. Old male, American.',
    bestFor: 'Wise narrator voice',
  },
]

const ALLOWED_MODEL_IDS = new Set(MODEL_OPTIONS.map((model) => model.id))

export function getModelOptions() {
  const envModels = process.env.OPENROUTER_MODELS
    ?.split(',')
    .map((model) => model.trim())
    .filter((model) => Boolean(model) && ALLOWED_MODEL_IDS.has(normalizeModelId(model)))

  if (!envModels?.length) {
    return MODEL_OPTIONS
  }

  const defaultsById = new Map(MODEL_OPTIONS.map((model) => [model.id, model]))

  const fromEnv = envModels
    .map((modelId) => defaultsById.get(normalizeModelId(modelId)) ?? getModelOption(modelId))
    .filter(Boolean) as ModelOption[]

  const nvidiaModels = MODEL_OPTIONS.filter((model) => model.category === 'NVIDIA')
  const seenIds = new Set(fromEnv.map((m) => m.id))

  return [...fromEnv, ...nvidiaModels.filter((m) => !seenIds.has(m.id))]
}

export function getModelOption(modelId: string) {
  const normalizedId = normalizeModelId(modelId)
  return MODEL_OPTIONS.find((model) => model.id === normalizedId) ?? MODEL_OPTIONS[0]
}

export function normalizeModelId(modelId: string) {
  return MODEL_ID_ALIASES[modelId] ?? modelId
}
