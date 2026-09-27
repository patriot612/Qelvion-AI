# Qelvion-AI — Final Continuation Report — 2026-09-27

## 1. Implemented

- Full protected Admin Mini App/API surface for the required operational sections.
- Server-side Telegram WebApp `initData` verification + `ADMIN_TELEGRAM_IDS` authorization.
- Admin audit trail migration and repository.
- Search Mode moved to persistent D1-backed mode state and launched from `🔎 Поиск` in Tools.
- Search remains an isolated SearXNG → SearchContext → Search Editor → sources pipeline.
- Chat lifecycle expanded to use dialog history, role/model configuration, daily points, operation billing, persistence and failure settlement.
- Queue dispatcher/processors completed for the task types present in the current architecture.
- Daily points now participate in reservations before purchased balance points.
- Reservation failure cancels the operation safely.
- Runtime configuration/migrations/docs updated.
- Hidden backup admin command handlers added without adding them to the normal command menu.

## 2. Preserved

- Cloudflare Workers runtime.
- Cloudflare D1.
- Cloudflare Queues.
- TypeScript.
- grammY.
- Existing AI Gateway.
- Existing Model Registry.
- Existing point ledger.
- Existing operation lifecycle.
- Existing idempotency/update dedupe.
- Existing Telegram user menu and UX vocabulary.
- Existing migrations/tests.

## 3. Files / modules materially changed

- `src/telegram/admin.ts`
- `src/telegram/updates/router.ts`
- `src/telegram/runtime.ts`
- `src/worker.ts`
- `src/ai/registry.ts`
- `src/core/operations/service.ts`
- `src/db/repositories/admin.ts`
- `src/db/repositories/dialogs.ts`
- `src/db/repositories/daily-points.ts`
- `src/db/repositories/points.ts`
- `src/db/repositories/users.ts`
- `src/db/repositories/operations.ts`
- `src/db/schema/types.ts`
- `src/features/dialogs/service.ts`
- `src/features/tools/screens.ts`
- `src/features/search/service.ts`
- `src/queue/consumer/processor.ts`
- `src/queue/consumer/media.ts`
- `src/queue/consumer/worker.ts`
- `src/queue/tasks/types.ts`
- `src/env.ts`
- `.dev.vars.example`
- `README.md`
- `docs.md`
- `GAP_ANALYSIS.md`
- `CHANGE_LEDGER.md`

## 4. Migrations added

- `0004_admin_audit.sql`
- `0005_runtime_config.sql`
- `0006_search_mode_state.sql`

## 5. Required secrets

Only the names are listed:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `ADMIN_TELEGRAM_IDS`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_AI_API_KEY`
- `OPENROUTER_API_KEY`
- optional server-side SearXNG credentials when needed

## 6. Bindings

- `QELVION_DB`
- `HEAVY_TASK_QUEUE`

## 7. Safe runtime configuration

- `ADMIN_MINI_APP_URL`
- `SEARXNG_BASE_URL`

Admin Mini App URL must be HTTPS and is used as the `web_app` URL by `/admin`.

## 8. Tests/checks

### Executed

- Independent TypeScript transpilation/syntax pass over all source and test TypeScript files: `TS_TRANSPILE_ERRORS=0`.
- `npm install --offline`: failed with `ENOTCACHED` because required packages are not present in npm cache.
- `npm install`: cannot complete because the environment cannot reach `registry.npmjs.org`.
- `npm test`: not runnable because `vitest` is unavailable.
- `npm run typecheck`: not successful because `@cloudflare/workers-types` is unavailable.
- `npm run check`: not successful because `typecheck` cannot run with missing dependencies.

### Not claimed as verified

No real Telegram, D1 remote, Queue, SearXNG, or AI provider runtime execution was possible without external credentials/services.

## 9. Security verification

- Telegram webhook secret boundary preserved.
- Telegram User ID remains authoritative identity.
- Admin WebApp initData is cryptographically checked server-side.
- Full admin allowlist is never sent to frontend.
- Admin API checks authorization on every request.
- Provider secrets are not placed in models/config/UI.
- SearXNG URL is server-side `SEARXNG_BASE_URL`; no D1/config override can redirect the backend.
- Optional SearXNG Basic Auth is server-side through `SEARXNG_USERNAME` / `SEARXNG_PASSWORD`; the Admin UI never exposes these values.
- Admin point mutations write ledger + audit data.
- Search citations must originate from actual normalized search results.

## 10. Remaining limitations

The source project now contains the Telegram media delivery layer for image/audio/voice outputs and textual document results. The public Tools flows create the existing Queue tasks, reserve points once, and carry the Telegram target into delivery. Live end-to-end delivery remains unverified because real Telegram/provider credentials are unavailable.

The Admin Mini App is deliberately compact and operational rather than a large frontend framework application.

Full automated suite execution remains blocked by the current environment's package/network restrictions. The project now contains additional regression tests for Search safety, terminal operation retry behavior and configuration boundaries, but those tests are not claimed as passed until Vitest is installed.


## Final runtime-readiness hardening — 2026-09-27

### Implemented in this iteration
- Search cold-start handling: 30s default timeout, bounded to 5–45s, one sequential retry for transient network/5xx/429 failures.
- Search webhook path uses `ExecutionContext.waitUntil()` to acknowledge Telegram promptly while the search job continues.
- Search retry reuses the same operation/request id, so it does not create a second billing reservation.
- Search base URL is validated and remains exclusively `SEARXNG_BASE_URL`.
- Image/audio/voice queue outputs can now be delivered to Telegram through the existing grammY Bot API / `InputFile` path.
- Media operation state is `delivery_pending` until Telegram delivery succeeds; Queue retries repeat delivery rather than provider generation, and point capture occurs only after successful delivery.
- Added `0007_search_timeout_hardening.sql` without changing already-created `0003_search_admin.sql`.
- Added `0008_media_pending_state.sql` to persist the existing user pending-task state used by the Tools → Queue flow.

### Media limitation that remains real
Telegram Tools now have user-triggered image/document/audio/voice task creation through the existing operation + point-ledger + Queue producer path. Document results are delivered as generated `.txt` documents because the current provider contract returns textual output rather than a binary document.

There is also an unavoidable at-least-once side-effect window between a successful Telegram send and persistence of the `delivered` state. The current code prevents repeated provider generation and repeated point capture, but exact-once Telegram delivery cannot be guaranteed without an external idempotency facility from Telegram or another durable delivery intermediary.

### Verification classification
- VERIFIED BY CODE: Search retry policy, Search URL boundary, Search background execution path, media delivery methods, operation delivery states, migration ordering.
- VERIFIED BY TEST: Not currently executable because dependencies are unavailable. Regression tests were added for Search retry and media delivery boundaries.
- VERIFIED BY RUNTIME: None for Telegram, Cloudflare D1/Queues, Render SearXNG, or AI providers.
- NOT VERIFIED — MISSING DEPENDENCIES: `npm install` cannot complete in the current environment; `vitest` and the project-local TypeScript/npm dependencies are unavailable; a global `tsc` executable was used only for a no-resolve parser/static pass.
- NOT VERIFIED — MISSING CREDENTIALS: Telegram, Cloudflare, SearXNG, and AI provider credentials are not present for external runtime calls.
- NOT VERIFIED — EXTERNAL SERVICE UNAVAILABLE: Render SearXNG cold-start and Telegram delivery were not exercised against live services.
