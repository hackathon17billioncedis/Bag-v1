export const NVIDIA_BASE_URL = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1'

export function getNvidiaApiKey() {
  const key = process.env.NVIDIA_API_KEY
  if (!key) {
    throw new Error('NVIDIA_API_KEY is not configured.')
  }
  return key
}

export function nvidiaHeaders() {
  return {
    Authorization: `Bearer ${getNvidiaApiKey()}`,
    'Content-Type': 'application/json',
  }
}

export const NVIDIA_CHAT_MODEL_IDS = new Set([
  'nvidia/nemotron-3-super-120b-a12b',
  'deepseek-ai/deepseek-v3.2',
  'minimaxai/minimax-m2.7',
  'z-ai/glm-5.1',
  'moonshotai/kimi-k2.5',
  'meta/llama-4-maverick',
  'google/gemma-4-31b-it',
])

export function isNvidiaChatModel(modelId: string) {
  return NVIDIA_CHAT_MODEL_IDS.has(modelId)
}