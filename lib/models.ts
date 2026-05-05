export type ModelOption = {
  id: string
  label: string
  category: string
  description: string
  bestFor: string
}

const MODEL_ID_ALIASES: Record<string, string> = {
  'meta-llama/llama-3.3-70b-instruct': 'meta-llama/llama-3.3-70b-instruct:free',
  'meta-llama/llama-3.2-3b-instruct': 'meta-llama/llama-3.2-3b-instruct:free',
  'google/gemma-4-26b-a4b-it': 'google/gemma-4-26b-a4b-it:free',
  'google/gemma-4-31b-it': 'google/gemma-4-31b-it:free',
  'google/gemma-3n-e2b-it': 'google/gemma-3n-e2b-it:free',
  'google/gemma-3n-e4b-it': 'google/gemma-3n-e4b-it:free',
  'google/gemma-3-4b-it': 'google/gemma-3-4b-it:free',
  'google/gemma-3-12b-it': 'google/gemma-3-12b-it:free',
  'google/gemma-3-27b-it': 'google/gemma-3-27b-it:free',
  'qwen/qwen3-next-80b-a3b-instruct': 'qwen/qwen3-next-80b-a3b-instruct:free',
  'qwen/qwen3-coder': 'qwen/qwen3-coder:free',
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
Keep answers direct, natural, and practical.
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
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    label: 'Llama 3.3 70B',
    category: 'Llama',
    description: 'Bigger free model with more reasoning depth.',
    bestFor: 'Harder conversations',
  },
  {
    id: 'meta-llama/llama-3.2-3b-instruct:free',
    label: 'Llama 3.2 3B',
    category: 'Llama',
    description: 'Lightweight and quick.',
    bestFor: 'Fast, short replies',
  },
  {
    id: 'google/gemma-4-26b-a4b-it:free',
    label: 'Gemma 4 26B A4B',
    category: 'Gemma',
    description: 'Efficient free Gemma option.',
    bestFor: 'General reasoning',
  },
  {
    id: 'google/gemma-4-31b-it:free',
    label: 'Gemma 4 31B',
    category: 'Gemma',
    description: 'Larger free Gemma model.',
    bestFor: 'Deeper responses',
  },
  {
    id: 'google/gemma-3n-e2b-it:free',
    label: 'Gemma 3N E2B',
    category: 'Gemma',
    description: 'Compact and responsive.',
    bestFor: 'Quick lightweight prompts',
  },
  {
    id: 'google/gemma-3n-e4b-it:free',
    label: 'Gemma 3N E4B',
    category: 'Gemma',
    description: 'Balanced compact model.',
    bestFor: 'General lightweight chat',
  },
  {
    id: 'google/gemma-3-4b-it:free',
    label: 'Gemma 3 4B',
    category: 'Gemma',
    description: 'Fast free option for everyday use.',
    bestFor: 'Cheap default chat',
  },
  {
    id: 'google/gemma-3-12b-it:free',
    label: 'Gemma 3 12B',
    category: 'Gemma',
    description: 'Middle-ground free model.',
    bestFor: 'Slightly richer answers',
  },
  {
    id: 'google/gemma-3-27b-it:free',
    label: 'Gemma 3 27B',
    category: 'Gemma',
    description: 'Larger free Gemma variant.',
    bestFor: 'More thoughtful replies',
  },
  {
    id: 'openai/gpt-oss-20b:free',
    label: 'GPT OSS 20B (Free)',
    category: 'OpenAI',
    description: 'OpenAI open-source model.',
    bestFor: 'General assistant tasks',
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
    id: 'qwen/qwen3-next-80b-a3b-instruct:free',
    label: 'Qwen3 Next 80B',
    category: 'Qwen',
    description: 'Large free Qwen model.',
    bestFor: 'Complex prompts',
  },
  {
    id: 'qwen/qwen3-coder:free',
    label: 'Qwen3 Coder',
    category: 'Qwen',
    description: 'Best for coding help.',
    bestFor: 'Programming tasks',
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

export function getModelOptions() {
  const envModels = process.env.OPENROUTER_MODELS
    ?.split(',')
    .map((model) => model.trim())
    .filter(Boolean)

  if (!envModels?.length) {
    return MODEL_OPTIONS
  }

  const defaultsById = new Map(MODEL_OPTIONS.map((model) => [model.id, model]))

  return envModels.map((modelId) => defaultsById.get(normalizeModelId(modelId)) ?? getModelOption(modelId))
}

export function getModelOption(modelId: string) {
  const normalizedId = normalizeModelId(modelId)
  return MODEL_OPTIONS.find((model) => model.id === normalizedId) ?? {
    id: normalizedId,
    label: modelId,
    category: 'Custom',
    description: 'Custom model selected through environment or request.',
    bestFor: 'Custom use',
  }
}

export function normalizeModelId(modelId: string) {
  return MODEL_ID_ALIASES[modelId] ?? modelId
}
