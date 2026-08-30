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
  'openai/gpt-oss-20b': 'openai/gpt-oss-20b:free',
  'openai/gpt-oss-20b:free': 'openai/gpt-oss-20b:free',
}

export const APP_NAME = 'Bag-v1'
export const DEFAULT_MODEL =
  normalizeModelId(
    process.env.OPENROUTER_DEFAULT_MODEL ??
      process.env.OPENROUTER_MODEL ??
      'meta-llama/llama-3.1-8b-instruct',
  )
export const DEFAULT_IMAGE_MODEL = 'black-forest-labs/FLUX.1-dev'
export const DEFAULT_TTS_MODEL = 'nvidia/magpie-tts-multilingual'
export const DEFAULT_VIDEO_MODEL = 'nvidia/cosmos3-nano'

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
    label: 'Gemma 4 26B A4B',
    category: 'Gemma',
    description: 'Efficient free Gemma option.',
    bestFor: 'General reasoning',
  },
  {
    id: 'openai/gpt-oss-20b:free',
    label: 'GPT OSS 20B (Free)',
    category: 'OpenAI',
    description: 'OpenAI open-source model.',
    bestFor: 'General assistant tasks',
  },
  {
    id: 'openai/gpt-oss-120b:free',
    label: 'GPT OSS 120B (Free)',
    category: 'OpenAI',
    description: 'Larger free GPT OSS option.',
    bestFor: 'Higher-quality reasoning',
  },
  {
    id: 'z-ai/glm-4.5-air:free',
    label: 'GLM 4.5 Air',
    category: 'Z.AI',
    description: 'Lightweight GLM option.',
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
    id: 'nvidia/nemotron-3.5-lightning:free',
    label: 'Nemotron 3.5 Lightning (Free)',
    category: 'NVIDIA',
    description: 'Free fast Nemotron model via OpenRouter.',
    bestFor: 'Fast general chat',
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

export const IMAGE_MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'black-forest-labs/FLUX.1-dev',
    label: 'FLUX.1-dev',
    category: 'Image',
    description: 'Highest quality FLUX image generation.',
    bestFor: 'Detailed, high-quality images',
  },
  {
    id: 'black-forest-labs/FLUX.1-schnell',
    label: 'FLUX.1-schnell',
    category: 'Image',
    description: 'Fast distilled FLUX variant.',
    bestFor: 'Quick image generation',
  },
  {
    id: 'black-forest-labs/flux.2-klein-4b',
    label: 'FLUX.2 Klein 4B',
    category: 'Image',
    description: 'Efficient FLUX.2 variant.',
    bestFor: 'Balanced quality & speed',
  },
  {
    id: 'google/diffusiongemma-26b-a4b-it',
    label: 'DiffusionGemma 26B',
    category: 'Image',
    description: 'Google open diffusion model.',
    bestFor: 'Experimental image gen',
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
]

export const VIDEO_MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'nvidia/cosmos3-nano',
    label: 'Cosmos3 Nano',
    category: 'Video',
    description: 'Physics-aware text-to-video generation.',
    bestFor: 'Text & image to video',
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
