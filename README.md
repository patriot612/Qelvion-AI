# Qelvion-AI

Production completion of the existing Qelvion-AI Telegram platform on Cloudflare Workers + D1 + Queues + TypeScript + grammY.

## Architecture

- Fast Chat path: Telegram → Worker → user/dialog/config/model registry → existing AI Gateway → provider → billing/operation settlement → D1 dialog → Telegram.
- Search path: Telegram Tools → persisted Search Mode → SearXNG HTTP API → normalized/deduplicated SearchContext → selected Search Editor model through existing AI Gateway → source validation → billing/operation settlement → Telegram.
- Heavy path: Telegram/application task creation → operation → `HEAVY_TASK_QUEUE` → idempotent task processor → provider/service → settlement → delivery boundary.
- Admin path: Telegram Mini App → server-side Telegram WebApp `initData` verification → `ADMIN_TELEGRAM_IDS` → protected Admin API → existing D1/services.

Secrets never belong in D1, source files, frontend, config records, or Git.

## Required production setup

Bindings:
- `QELVION_DB`
- `HEAVY_TASK_QUEUE`

Secrets:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `ADMIN_TELEGRAM_IDS`
- only the AI provider secrets actually used (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY`, `OPENROUTER_API_KEY`)
- optional SearXNG authentication secrets when required by the instance

Safe application configuration:
- D1 `config`
- D1 `models`
- D1 `roles`
- D1 `tariffs`

Runtime/static configuration:
- `ADMIN_MINI_APP_URL` — HTTPS URL opened by `/admin`
- `SEARXNG_BASE_URL` — server-side only

## Local verification

```bash
npm install
npm run typecheck
npm test
npm run check
```

At the time of this handoff the environment cannot reach `registry.npmjs.org` and has no cached npm packages, so dependency installation and therefore Vitest/Wrangler typechecking cannot be completed in this environment.

An independent TypeScript transpilation pass is run over all source and test files as an additional syntax check.

## Database

Apply all migrations in order. New migrations in this continuation:

- `0004_admin_audit.sql`
- `0005_runtime_config.sql`
- `0006_search_mode_state.sql`
- `0007_search_timeout_hardening.sql`
- `0008_media_pending_state.sql`

## Telegram

Webhook:

`POST https://<your-worker-host>/telegram/webhook`

Configure the same random secret as `TELEGRAM_WEBHOOK_SECRET` in Telegram's webhook `secret_token`.

`/admin` is intentionally not added to the public command menu. It is a server-side allowlisted entry point and opens `ADMIN_MINI_APP_URL` only for admins.

## Search Mode

The Tools button `🔎 Поиск` is the primary user entry point. Search Mode is persisted per user in D1 and is not a conversational Chat Mode fallback.

Each search request uses only:
- current query;
- Search Mode instructions;
- current normalized SearXNG results.

Regular `dialog_messages` are not sent to the Search Editor.

## Admin Mini App

The protected UI contains:
- Dashboard
- Users
- Models
- AI Roles
- Tariffs
- Payments
- Operations
- Configuration
- Queue / System
- Audit

Admin actions are server-side. Point changes use the existing point ledger semantics and dangerous UI actions request confirmation.

## Search Mode runtime configuration

Search Mode uses `SEARXNG_BASE_URL` as the server-side SearXNG endpoint. It is not read from D1/config and is never accepted from Telegram/user input. Optional SearXNG Basic Auth uses `SEARXNG_USERNAME` and `SEARXNG_PASSWORD` as server-side secrets. The SearXNG instance must expose JSON search responses (`/search?...&format=json`).

### Cold-start and retry policy

Search uses a 30s default request timeout, bounded to 5–45s by server-side configuration, and at most one sequential retry for transient network errors, HTTP 5xx, or 429. Retries reuse the same operation/request id and do not create a second billing reservation. Search requests are scheduled with the Worker `ExecutionContext.waitUntil()` path so a slow Render cold start does not require the Telegram webhook handler to remain blocked for the full search duration.

SearXNG is queried only through the server-side `SEARXNG_BASE_URL`; the URL is never accepted from user input or D1.


## Exact production configuration

### Cloudflare Secrets
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `ADMIN_TELEGRAM_IDS`
- `OPENAI_API_KEY` (required when an OpenAI model/media task is configured)
- `ANTHROPIC_API_KEY` (only when an Anthropic model is configured)
- `GOOGLE_AI_API_KEY` (only when a Google model is configured)
- `OPENROUTER_API_KEY` (only when an OpenRouter model is configured)
- `SEARXNG_USERNAME` / `SEARXNG_PASSWORD` (only when the configured SearXNG service requires Basic Auth)

### Cloudflare Variables
- `SEARXNG_BASE_URL`
- `ADMIN_MINI_APP_URL`

### Cloudflare Bindings
- `QELVION_DB`
- `HEAVY_TASK_QUEUE`
