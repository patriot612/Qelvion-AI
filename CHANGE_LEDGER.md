# Change ledger — Qelvion-AI continuation

Baseline: `Qelvion-AI-production-completion.zip`

## Implemented in continuation

- Added `D1AdminRepository` with users, roles, tariffs, payments, operations, dialogs, ledger and audit data access.
- Added `0004_admin_audit.sql`.
- Expanded protected Admin API and Mini App across Dashboard, Users, Models, AI Roles, Tariffs, Payments, Operations, Configuration, Queue/System and Audit.
- Added server-side admin actions for user points/status/subscription and model/role/tariff/config updates.
- Added configuration-backed Search settings and system health endpoint.
- Added Telegram Search Mode state and made `🔎 Поиск` from Tools the primary Search Mode entrypoint; `/search` is no longer the primary UX.
- Added dialog limits/archival helpers and daily-point repository.
- Expanded real Chat execution to use dialog history, role, model registry, operation lifecycle and billing settlement.
- Added queue processor dispatcher for image/document/audio/voice with operation terminal-state guards and queue ack/retry handling.
- Added `0005_runtime_config.sql`.

## Deliberate limitations

- Binary document/audio/voice provider contracts are not present in the source project. The processor has explicit bounded handlers rather than inventing unsupported provider integrations.
- Admin frontend is functional and mobile-first but intentionally uses a compact JSON-backed view layer rather than introducing a new frontend framework.

## Final technical hardening — 2026-09-27

- Removed D1/config SearXNG URL override; `SEARXNG_BASE_URL` is the sole backend endpoint source.
- `/admin` entrypoint now requires server-side Telegram WebApp initData verification and admin allowlist before serving the Mini App HTML.
- Backup `/admin_block` and `/admin_unblock` now write audit entries instead of silently mutating status.
- Admin SearXNG health probe now uses optional server-side Basic Auth credentials.
- Added regression tests for empty Search result behavior, terminal operation retry guards and search URL boundary behavior.
- Re-ran static/smoke/security scans and real npm commands; npm dependency installation remains blocked by registry/network and no cache.


## Final media/search hardening — 2026-09-27

- Added bounded SearXNG cold-start handling: 30s default timeout, 5–45s server-side clamp, one sequential transient retry, same operation/request id and no additional billing reservation.
- Moved Search Mode execution to `ExecutionContext.waitUntil()` when running under Cloudflare so the Telegram webhook can acknowledge promptly while the bounded search job completes in the background.
- Added Search base-URL validation and preserved `SEARXNG_BASE_URL` as the only endpoint source.
- Added Telegram media delivery for image/audio/voice provider outputs using the existing grammY Bot API and `InputFile`; operation state is `delivery_pending` until Telegram delivery succeeds.
- Queue retries of `delivery_pending` operations repeat delivery only; provider generation and point capture are not repeated.
- Document tasks remain explicitly blocked at delivery because the current provider contract returns text rather than a binary document.
- Added safe additive migration `0007_search_timeout_hardening.sql`; existing migration `0003_search_admin.sql` is not rewritten.
- Added `0008_media_pending_state.sql` for persistent pending media task state, reusing the existing users table rather than introducing a new task-state system.
- Connected the existing Tools UI to the Queue producer for image/document/audio/voice, with one operation reservation and Telegram target metadata.
- Full runtime verification remains blocked until npm dependencies and real Telegram/Cloudflare/SearXNG/provider credentials are available.
