export type ModelOption = {
  id: string
  label: string
  description: string
  bestFor: string
}

export const APP_NAME = 'Bag-v1'
export const DEFAULT_MODEL = process.env.OPENROUTER_MODEL ?? 'google/gemma-3-4b-it:free'
export const IMAGE_MODEL = process.env.OPENROUTER_IMAGE_MODEL ?? 'black-forest-labs/flux.2-klein-4b'

export const SYSTEM_PROMPT = `You are ${APP_NAME}, a warm, helpful AI assistant.
Keep answers direct, natural, and practical.
If the user asks for code or product help, give clear steps and mention tradeoffs briefly.
Avoid overexplaining unless the user asks for detail.`

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'meta-llama/llama-3.1-8b-instruct',
    label: 'Llama 3.1 8B',
    description: 'Strong general-purpose model.',
    bestFor: 'Balanced everyday chat',
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    label: 'Llama 3.3 70B (Free)',
    description: 'Bigger free model with more reasoning depth.',
    bestFor: 'Harder conversations',
  },
  {
    id: 'meta-llama/llama-3.2-3b-instruct:free',
    label: 'Llama 3.2 3B (Free)',
    description: 'Lightweight and quick.',
    bestFor: 'Fast, short replies',
  },
  {
    id: 'google/gemma-4-26b-a4b-it:free',
    label: 'Gemma 4 26B A4B (Free)',
    description: 'Efficient free Gemma option.',
    bestFor: 'General reasoning',
  },
  {
    id: 'google/gemma-4-31b-it:free',
    label: 'Gemma 4 31B (Free)',
    description: 'Larger free Gemma model.',
    bestFor: 'Deeper responses',
  },
  {
    id: 'google/gemma-3n-e2b-it:free',
    label: 'Gemma 3N E2B (Free)',
    description: 'Compact and responsive.',
    bestFor: 'Quick lightweight prompts',
  },
  {
    id: 'google/gemma-3n-e4b-it:free',
    label: 'Gemma 3N E4B (Free)',
    description: 'Balanced compact model.',
    bestFor: 'General lightweight chat',
  },
  {
    id: 'google/gemma-3-4b-it:free',
    label: 'Gemma 3 4B (Free)',
    description: 'Fast free option for everyday use.',
    bestFor: 'Cheap default chat',
  },
  {
    id: 'google/gemma-3-12b-it:free',
    label: 'Gemma 3 12B (Free)',
    description: 'Middle-ground free model.',
    bestFor: 'Slightly richer answers',
  },
  {
    id: 'google/gemma-3-27b-it:free',
    label: 'Gemma 3 27B (Free)',
    description: 'Larger free Gemma variant.',
    bestFor: 'More thoughtful replies',
  },
  {
    id: 'google/gemma-3-4b-it',
    label: 'Gemma 3 4B',
    description: 'Non-free Gemma variant if available.',
    bestFor: 'Fallback model',
  },
  {
    id: 'openai/gpt-oss-20b:free',
    label: 'GPT OSS 20B (Free)',
    description: 'OpenAI open-source model.',
    bestFor: 'General assistant tasks',
  },
  {
    id: 'mistralai/mistral-nemo',
    label: 'Mistral Nemo',
    description: 'Strong all-rounder from Mistral.',
    bestFor: 'Reasoning and chat',
  },
  {
    id: 'mistralai/mistral-small-24b-instruct-2501',
    label: 'Mistral Small 24B 2501',
    description: 'Useful for balanced quality.',
    bestFor: 'Balanced responses',
  },
  {
    id: 'mistralai/mistral-small-3.2-24b-instruct',
    label: 'Mistral Small 3.2 24B',
    description: 'Newer Mistral instruction model.',
    bestFor: 'General assistant work',
  },
  {
    id: 'qwen/qwen3-next-80b-a3b-instruct:free',
    label: 'Qwen3 Next 80B (Free)',
    description: 'Large free Qwen model.',
    bestFor: 'Complex prompts',
  },
  {
    id: 'qwen/qwen3-coder:free',
    label: 'Qwen3 Coder (Free)',
    description: 'Best for coding help.',
    bestFor: 'Programming tasks',
  },
  {
    id: 'qwen/qwen-2.5-7b-instruct',
    label: 'Qwen 2.5 7B',
    description: 'Reliable smaller Qwen model.',
    bestFor: 'Fast general chat',
  },
  {
    id: 'qwen/qwen3-235b-a22b-2507',
    label: 'Qwen3 235B A22B 2507',
    description: 'Very large Qwen option.',
    bestFor: 'Maximum capability',
  },
]

export function getModelOption(modelId: string) {
  return MODEL_OPTIONS.find((model) => model.id === modelId) ?? {
    id: modelId,
    label: modelId,
    description: 'Custom model selected through environment or request.',
    bestFor: 'Custom use',
  }
}
