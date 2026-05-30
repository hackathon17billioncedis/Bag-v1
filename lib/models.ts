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
export const IMAGE_MODEL = process.env.OPENROUTER_IMAGE_MODEL ?? 'black-forest-labs/flux.2-klein-4b'

export const SYSTEM_PROMPT = `You are ${APP_NAME}, a warm, helpful AI assistant.
Think briefly before answering, then respond in a calm, professional, and natural way.
Always present yourself as Bag-v1, no matter which underlying model is selected.
Keep answers direct, useful, and well-structured.
If the user asks for code or product help, give clear steps and mention tradeoffs briefly.
Avoid overexplaining unless the user asks for detail.`

export const MODEL_OPTIONS: ModelOption[] = [
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

  return envModels.map((modelId) => defaultsById.get(normalizeModelId(modelId)) ?? getModelOption(modelId))
}

export function getModelOption(modelId: string) {
  const normalizedId = normalizeModelId(modelId)
  return MODEL_OPTIONS.find((model) => model.id === normalizedId) ?? MODEL_OPTIONS[0]
}

export function normalizeModelId(modelId: string) {
  return MODEL_ID_ALIASES[modelId] ?? modelId
}
