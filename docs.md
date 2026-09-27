# Qelvion-AI production handoff

## 1. Cloudflare resources

Create/configure:
- D1 database bound as `QELVION_DB`
- Queue producer bound as `HEAVY_TASK_QUEUE`
- Queue consumer for `qelvion-heavy-tasks`
- configured DLQ according to the Wrangler configuration

## 2. Secrets

Use Wrangler Secrets for production:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put ADMIN_TELEGRAM_IDS
```

Add only provider secrets actually used.

Do not store any secret in D1, `wrangler.jsonc`, frontend assets, config rows, or Git.

## 3. Safe runtime configuration

Set `ADMIN_MINI_APP_URL` to the final HTTPS Mini App URL, for example:

`https://<your-worker-host>/admin/`

Set `SEARXNG_BASE_URL` server-side. Do not expose it as user input.

If the SearXNG instance requires authentication, store the username/password server-side.

## 4. Database

```bash
npm run db:migrate:local
npm run db:migrate:remote
```

Run only the command for the environment you intend to initialize.

Migrations added after the previous handoff:
- `0004_admin_audit.sql`
- `0005_runtime_config.sql`
- `0006_search_mode_state.sql`
- `0007_search_timeout_hardening.sql`
- `0008_media_pending_state.sql`

## 5. Telegram webhook

Configure Telegram with:

`POST https://<your-worker-host>/telegram/webhook`

and set the same value as `TELEGRAM_WEBHOOK_SECRET` in Telegram's webhook `secret_token`.

The Worker continues to reject webhook requests without a valid `X-Telegram-Bot-Api-Secret-Token` and preserves update deduplication.

## 6. Admin Mini App

1. Set `ADMIN_MINI_APP_URL` to the HTTPS `/admin/` URL.
2. Deploy the Worker.
3. Open `/admin` from an allowlisted Telegram user.
4. Telegram WebApp `initData` is verified server-side with the bot token.
5. The verified Telegram user ID is checked against `ADMIN_TELEGRAM_IDS`.
6. Every Admin API request repeats server-side authorization.

The full allowlist is never sent to the frontend.

## 7. Search Mode

The `🔎 Поиск` button in Tools activates a persisted `search` mode in D1.

Execution:

`Telegram → Search Mode → SearXNG → normalized results → selected Search Editor model → source validation → billing settlement → Telegram`

SearXNG JSON must be enabled on the instance because the Worker requests `/search?...&format=json`.

The Search Editor receives no ordinary dialog history and does not have search/tool capabilities. If no usable results are found, the Worker returns a controlled no-result response without invoking the editor.

Search price and Search Editor model are configurable through D1/Admin.

## 8. AI provider/model configuration

The model registry stores `provider` and `provider_model_id`. A provider secret belongs to the provider, so multiple models can be registered against one provider credential without duplicating API keys.

API keys are never part of the model registry record.

## 9. Billing / points

The existing operation and point-ledger architecture remains authoritative.

- reserve
- capture
- release

Daily allowance is reset server-side and participates in reservations before purchased balance points are consumed.

Admin point changes use ledger entries and audit records rather than silent balance-only updates.

## 10. Queue

Heavy tasks use the existing `HEAVY_TASK_QUEUE` consumer.

The processor checks operation state before execution. Terminal operations are not regenerated. Successful queue messages are acknowledged; failed tasks are retried by the Queue runtime.

Supported task dispatcher types in the current architecture:
- image
- document
- audio
- voice

Provider execution is bounded by the provider contracts represented in the current project. Unsupported binary/media workflows are not silently fabricated.

## 11. Verification

Required commands:

```bash
npm install
npm run typecheck
npm test
npm run check
```

The current execution environment cannot reach `registry.npmjs.org` and has no cached npm packages. Consequently Vitest and Cloudflare type definitions are not available locally and these commands cannot currently produce a passing dependency-backed result.

An additional independent syntax/transpilation pass across all `src/**/*.ts` and `tests/**/*.ts` is used to catch TypeScript parser-level errors.

## SearXNG

Set `SEARXNG_BASE_URL` to the HTTPS/HTTP URL of the project's SearXNG instance. Do not store this value in D1 or the frontend. If the instance requires HTTP Basic Auth, configure `SEARXNG_USERNAME` and `SEARXNG_PASSWORD` as Cloudflare Secrets. The instance must enable JSON output in its SearXNG `search.formats` configuration.

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
