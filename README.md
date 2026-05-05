# Bag-v1

A Next.js and TypeScript upgrade of the Bag-v1 assistant for Vercel, now with email OTP authentication.

## What changed

- Replaced Flask, Jinja, and Python runtime code with Next.js App Router
- Moved chat and image generation into Vercel route handlers
- Swapped Python voice tooling for browser speech recognition and speech synthesis
- Kept the OpenRouter-powered assistant flow and image generation
- Upgraded from Google sign-in to a secure email OTP-based authentication system
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
OPENROUTER_DEFAULT_MODEL=google/gemma-3-4b-it
OPENROUTER_MODELS=meta-llama/llama-3.1-8b-instruct,meta-llama/llama-3.3-70b-instruct,meta-llama/llama-3.2-3b-instruct,google/gemma-4-26b-a4b-it,google/gemma-4-31b-it,google/gemma-3n-e2b-it,google/gemma-3n-e4b-it,google/gemma-3-4b-it,google/gemma-3-12b-it,google/gemma-3-27b-it,openai/gpt-oss-20b:free,mistralai/mistral-nemo,mistralai/mistral-small-24b-instruct-2501,mistralai/mistral-small-3.2-24b-instruct,qwen/qwen3-next-80b-a3b-instruct,qwen/qwen3-coder,qwen/qwen-2.5-7b-instruct,qwen/qwen3-235b-a22b-2507
OPENROUTER_IMAGE_MODEL=black-forest-labs/flux.2-klein-4b
KV_REST_API_URL=your-vercel-kv-url
KV_REST_API_TOKEN=your-vercel-kv-token
ADMIN_EMAIL=baginifred26@gmail.com
SMTP_USER=your_smtp_email@example.com
SMTP_PASSWORD=your_smtp_password
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
- `OPENROUTER_DEFAULT_MODEL` sets the starting model, while `OPENROUTER_MODELS` controls which models appear in the board
- Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` from your Google Cloud OAuth client
- Set `AUTH_SECRET` to a long random string so the app can sign its session cookie
- Set `NEXT_PUBLIC_API_BASE_URL` if you want the client to call an external API origin instead of the current site
- Google sign-in and account creation use the same flow, so there is no separate signup page anymore
- Voice features only work in browsers that support the Web Speech APIs
