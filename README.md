# Bag-v1

Bag-v1 is now a Next.js and TypeScript app built for Vercel.

## What changed

- Replaced Flask, Jinja, and Python runtime code with Next.js App Router
- Moved chat and image generation into Vercel route handlers
- Swapped Python voice tooling for browser speech recognition and speech synthesis
- Kept the OpenRouter-powered assistant flow and image generation

## Stack

- Next.js App Router
- React 19
- TypeScript
- OpenRouter API

## Features

- Chat UI with model switching
- Image generation panel
- Browser dictation
- Free browser text-to-speech with selectable voices
- Persistent per-user chat history when Vercel KV is configured
- Admin dashboard for usage stats and user activity, gated by `ADMIN_EMAIL`
- Gmail sign-in/sign-up through Clerk
- Vercel-ready deployment structure

## Environment variables

Create a `.env.local` file with:

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
APP_NAME=Bag-v1
APP_URL=http://localhost:3000
SITE_URL=http://localhost:3000
OPENROUTER_MODEL=google/gemma-3-4b-it:free
OPENROUTER_IMAGE_MODEL=black-forest-labs/flux.2-klein-4b
KV_REST_API_URL=your-vercel-kv-url
KV_REST_API_TOKEN=your-vercel-kv-token
ADMIN_EMAIL=baginifred26@gmail.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
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
- Enable Google OAuth inside your Clerk dashboard so Gmail sign-in and sign-up work
- Voice features only work in browsers that support the Web Speech APIs
