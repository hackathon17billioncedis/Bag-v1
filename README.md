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
- OpenRouter API

## Features

- Chat UI with a visible model board
- Image generation panel
- Browser dictation
- Free browser text-to-speech with selectable voices
- Persistent per-user chat history when Vercel KV is configured
- Admin dashboard for usage stats and user activity, gated by `ADMIN_EMAIL`
- Secure email OTP-based authentication system
- Vercel-ready deployment structure

## Environment variables

Create a `.env.local` file with:

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
APP_NAME=Bag-v1
APP_URL=http://localhost:3000
SITE_URL=http://localhost:3000
OPENROUTER_DEFAULT_MODEL=meta-llama/llama-3.1-8b-instruct
OPENROUTER_MODELS=meta-llama/llama-3.1-8b-instruct,meta-llama/llama-3.2-3b-instruct:free,meta-llama/llama-3.3-70b-instruct:free,google/gemma-4-26b-a4b-it:free,openai/gpt-oss-20b:free,openai/gpt-oss-120b:free,deepseek/deepseek-v4-flash:free,moonshotai/kimi-k2.6:free,minimax/minimax-m2.5:free,z-ai/glm-4.5-air:free,cognitivecomputations/dolphin-mistral-24b-venice-edition:free,mistralai/mistral-nemo,mistralai/mistral-small-24b-instruct-2501,mistralai/mistral-small-3.2-24b-instruct,qwen/qwen-2.5-7b-instruct,qwen/qwen3-235b-a22b-2507,nousresearch/hermes-3-llama-3.1-405b:free
OPENROUTER_IMAGE_MODEL=black-forest-labs/flux.2-klein-4b
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

- Chat requests go through `app/api/chat/route.ts`
- Image requests go through `app/api/image/route.ts`
- History is stored through Vercel KV when available
- The admin dashboard lives at `/admin`
- Admin access is allowlisted by `ADMIN_EMAIL`
- `OPENROUTER_DEFAULT_MODEL` sets the starting model, while `OPENROUTER_MODELS` controls which of the supported models appear in the board. The current roster excludes the models that failed in testing: Llama 3.2 3B, Llama 3.3 70B, DeepSeek V4 Flash, Kimi K2.6, MiniMax M2.5, Dolphin Mistral 24B Venice, and Hermes 3 Llama 3.1 405B
- Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` from your mail provider
- If you use Gmail SMTP, enable 2-Step Verification on that account and use a Google App Password for `SMTP_PASSWORD`
- Set `AUTH_SECRET` to a long random string so the app can sign its session cookie
- Set `NEXT_PUBLIC_API_BASE_URL` if you want the client to call an external API origin instead of the current site
- Email is collected before the one-time code is sent, so sign-in and sign-up use the same flow
- Voice features only work in browsers that support the Web Speech APIs
