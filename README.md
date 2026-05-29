# Douyin Launcher

Public web app for discovering TikTok/Douyin-style trends and preparing token launches through four.meme.

## Safety: API keys and secrets

This repo is intended to be public.

Do not commit real API keys, wallet secrets, private keys, browser profiles, Vercel project state, or local `.env` files.

Local/private values belong in `.env`, copied from `.env.example`. The `.gitignore` keeps `.env`, `.env.*`, `.vercel/`, `node_modules/`, logs, and backup files out of Git.

The app can run without a RapidAPI key: it falls back to the free TikWM feed.

## Run locally

```bash
npm install
npm start
```

Open:

```text
http://localhost:3232
```

## Check syntax

```bash
npm run check
```

## Notes for collaborators

1. Clone the repo.
2. Run `npm install`.
3. If you need private API values, create `.env` locally from `.env.example` and ask the maintainer for the values through a private channel.
4. Never paste real keys into `index.html`, API handlers, commits, GitHub issues, or pull requests.
