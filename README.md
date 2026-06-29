# Bag-v1

A Next.js and TypeScript upgrade of the Bag-v1 assistant for Vercel, now with SMTP-backed email OTP authentication.

## What changed

- Replaced Flask, Jinja, and Python runtime code with Next.js App Router
- Moved chat and image generation into Vercel route handlers
- Swapped Python voice tooling for browser speech recognition and speech synthesis
- Kept the OpenRouter-powered assistant flow and image generation
- Upgraded to a secure email OTP authentication system backed by SMTP
- Added a compact admin dashboard

## Stack

- Next.js App Router
- React 19
- TypeScript
- OpenRouter API (chat models)
- NVIDIA NIM API (image, TTS, video models)

## Features

- Chat UI with a visible model board (OpenRouter + NVIDIA chat models)
- Image generation panel powered by NVIDIA NIM (FLUX.1, DiffusionGemma)
- Video generation panel powered by NVIDIA Cosmos
- Browser dictation
- NVIDIA TTS for high-quality speech output (replaces browser speech synthesis)
- Persistent per-user chat history when Vercel KV is configured
- Admin dashboard for usage stats and user activity, gated by `ADMIN_EMAIL`
- Secure email OTP-based authentication system
- Vercel-ready deployment structure

## Environment variables

Create a `.env.local` file with:

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
NVIDIA_API_KEY=nvapi-your_nvidia_api_key_here
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
APP_NAME=Bag-v1
APP_URL=http://localhost:3000
SITE_URL=http://localhost:3000
OPENROUTER_DEFAULT_MODEL=meta-llama/llama-3.1-8b-instruct
OPENROUTER_MODELS=meta-llama/llama-3.1-8b-instruct,google/gemma-4-26b-a4b-it:free,openai/gpt-oss-20b:free,openai/gpt-oss-120b:free,z-ai/glm-4.5-air:free,mistralai/mistral-nemo,mistralai/mistral-small-24b-instruct-2501,mistralai/mistral-small-3.2-24b-instruct,qwen/qwen-2.5-7b-instruct,qwen/qwen3-235b-a22b-2507
KV_REST_API_URL=your-vercel-kv-url
KV_REST_API_TOKEN=your-vercel-kv-token
ADMIN_EMAIL=baginifred26@gmail.com
SMTP_USER=your_smtp_email@example.com
SMTP_PASSWORD=your_smtp_password
SMTP_HOST=your.smtp.host
SMTP_PORT=587
SMTP_SECURE=false
SMTP_FROM=Bag-v1 <no-reply@yourdomain.com>
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
AUTH_SECRET=generate_a_long_random_secret_here
```

### Provider notes

- **OpenRouter** handles all chat completions. `OPENROUTER_MODELS` controls which OpenRouter models appear in the model board.
- **NVIDIA NIM** handles image generation (FLUX models), text-to-speech (Magpie/Chatterbox), and video generation (Cosmos). Get a key at [build.nvidia.com](https://build.nvidia.com/settings/api-keys). No credit card required.
- NVIDIA chat models (Nemotron, DeepSeek, MiniMax, GLM, Kimi, Llama 4, Gemma 4) are always available alongside OpenRouter models and don't need to be added to `OPENROUTER_MODELS`.

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Build for Vercel

```bash
npm run build
```

Vercel will detect the Next.js app automatically.

## Notes

- Chat requests go through `app/api/chat/route.ts`, routing to either OpenRouter or NVIDIA NIM depending on the model.
- Image requests go through `app/api/image/route.ts` via NVIDIA NIM.
- TTS requests go through `app/api/tts/route.ts` via NVIDIA NIM.
- Video requests go through `app/api/video/route.ts` via NVIDIA Cosmos.
- History is stored through Vercel KV when available
- The admin dashboard lives at `/admin`
- Admin access is allowlisted by `ADMIN_EMAIL`
- `OPENROUTER_DEFAULT_MODEL` sets the starting model, while `OPENROUTER_MODELS` controls which of the supported OpenRouter models appear in the board.
- NVIDIA chat models (Nemotron, DeepSeek, MiniMax, GLM, Kimi, Llama 4, Gemma 4) always appear in the model board regardless of `OPENROUTER_MODELS`.
- Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` from your mail provider
- If you use Gmail SMTP, enable 2-Step Verification on that account and use a Google App Password for `SMTP_PASSWORD`
- Set `AUTH_SECRET` to a long random string so the app can sign its session cookie
- Set `NEXT_PUBLIC_API_BASE_URL` if you want the client to call an external API origin instead of the current site
- Email is collected before the one-time code is sent, so sign-in and sign-up use the same flow
- Voice features use NVIDIA NIM TTS (Magpie / Chatterbox) instead of browser speech synthesis for higher quality output
