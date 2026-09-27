# Qelvion-AI Gap Analysis — continuation final audit draft — 2026-09-27

## Scope

Source of truth: `Qelvion-AI_Production_Completion_Admin_Mini_App_Prompt_Search_Mode_Final(1).docx`.

Baseline: `Qelvion-AI-production-completion.zip`.

This document reflects the current continuation workspace, not the previous intermediate ZIP.

## Implemented / preserved

### Existing architecture
- Cloudflare Workers + D1 + Cloudflare Queues + TypeScript + grammY preserved.
- Existing AI Gateway preserved.
- Existing D1 `models` registry preserved and extended through existing config mapping.
- Existing `operations`, `point_ledger`, idempotency/update-dedupe and webhook-secret boundaries preserved.
- Existing user Telegram menu labels and emoji preserved.

### AI providers / Model Registry
- OpenAI, Anthropic, Google AI and OpenRouter adapters remain behind the existing AI Gateway.
- Model selection uses D1 `models.provider` + `provider_model_id`.
- Multiple models may share one provider credential; API keys are not stored per model.
- Search Editor is a separate AI capability, not a second AI system.

### Search Mode
- `🔎 Поиск` in Tools is now the primary user entry point.
- Search Mode state persists in D1 as `users.active_mode` rather than volatile Worker memory.
- `/search <query>` is not the primary UX.
- Search execution is SearXNG → normalization/deduplication/limit → selected Search Editor model → source validation → settlement → Telegram.
- Regular dialog history is not supplied to Search Editor.
- The Search Editor cannot call web/search/tools through the current provider contract.
- No usable results produce a controlled response without invoking the editor.
- Search price is configuration-driven and charged through existing operation/point-ledger flow.
- Source URLs must originate from actual SearXNG results.
- Search Editor model is selected through existing Model Registry/config.

### Billing / points
- Existing reserve/capture/release architecture remains authoritative.
- Daily allowance reset remains server-side and now participates in point reservation before balance points.
- Reservations, captures and releases use idempotent ledger entries.
- Admin balance changes are ledger entries plus audit data.
- Reservation failure now cancels the created operation instead of leaving an orphaned `created` operation.

### Chat / dialogs
- Real Chat path uses D1 user identity, daily reset, tariff-configured dialog limits, dialog history, role prompt, Model Registry and AI Gateway.
- User and assistant messages are persisted.
- Chat generation creates a billable operation and settles points on success/failure.
- Active dialog limits and message limits are enforced.
- Archive/retention helper logic exists for active/archive limit management.

### Queue
- Existing queue consumer boundary preserved.
- Processor dispatches image/document/audio/voice task types.
- Operation terminal states prevent duplicate regeneration.
- Successful Queue messages are acknowledged; failures are retried.
- Image path has a real OpenAI generation call.
- Audio/voice paths have real OpenAI speech-generation calls when configured.
- Document path uses the current textual AI contract and does not invent binary document APIs not present in the project.

### Admin Mini App / API
- Telegram WebApp `initData` is cryptographically verified server-side.
- Admin authorization uses `ADMIN_TELEGRAM_IDS` server-side.
- Protected API repeats authorization for every sensitive request.
- Admin sections are present: Dashboard, Users, Models, AI Roles, Tariffs, Payments, Operations, Configuration, Queue/System, Audit.
- Users: search/list/detail, points, set balance, subscription, block/unblock actions.
- Models: list/create/update/enable-disable/provider/provider_model_id/point_cost/capability/config support.
- Roles: read and upsert management.
- Tariffs: read and upsert management.
- Payments: read-only diagnostics.
- Operations: filtered diagnostics.
- Configuration: allowlisted safe configuration keys only.
- Queue/System: queue configured state, provider configuration state, optional SearXNG health probe.
- Audit trail: dangerous admin changes write before/after snapshots without secrets.
- `/admin` remains a hidden backup entry point; admin commands are not added to public command menus.

### Backup admin commands
- `/admin`
- `/admin_stats`
- `/admin_user`
- `/admin_points`
- `/admin_models`
- `/admin_block`
- `/admin_unblock`

Backend admin authorization is applied to these commands.

### Migrations
- `0003_search_admin.sql`
- `0004_admin_audit.sql`
- `0005_runtime_config.sql`
- `0006_search_mode_state.sql`

All are additive and use the existing migration directory.

## Verified in current environment

- Source/test TypeScript files pass an independent TypeScript transpilation/syntax pass: `TS_TRANSPILE_ERRORS=0`.
- ZIP/worktree source structure inspected after the continuation changes.
- No production secret values were added.
- Existing architecture was extended rather than replaced.

## Impossible to verify in current environment

### Dependency-backed tests
`npm install` cannot complete:
- network access to `registry.npmjs.org` is unavailable;
- npm offline cache does not contain the required packages (`ENOTCACHED`).

Therefore:
- `npm test` cannot execute because `vitest` is unavailable.
- `npm run typecheck` cannot execute successfully because `@cloudflare/workers-types` is unavailable.
- `npm run check` cannot execute successfully for the same missing dependency reason.

These are environment limitations, not reported as passing tests.

### External runtime verification
Not verified end-to-end because credentials/external services are unavailable:
- real Telegram webhook delivery;
- real Telegram WebApp session;
- real D1 remote database;
- real Cloudflare Queue delivery/retry/DLQ;
- real SearXNG instance;
- real OpenAI/Anthropic/Google/OpenRouter credentials;
- real provider/media delivery back to Telegram.

## Remaining / partially complete

1. Admin Mini App covers the required sections and protected endpoints. The frontend is intentionally compact/mobile-first; some diagnostics remain JSON-oriented and rich inline editing is minimal.
2. Admin role/tariff management is implemented as protected upsert endpoints; destructive deletes are intentionally omitted to avoid unsafe production data removal.
3. Queue processors now execute image/document/audio/voice tasks and deliver image/audio/voice outputs plus textual document results back to Telegram through the existing grammY API. The remaining verification gap is live runtime, not a missing delivery module.
4. Provider health is configuration/optional probe status, not a continuous monitoring subsystem.
5. Search answer grounding is enforced through restricted SearchContext + source URL validation. Exact per-sentence claim provenance is not machine-parsed beyond source-set validation.
6. `SEARXNG_BASE_URL` is the only backend URL source for SearXNG; no D1/config override exists. Optional SearXNG Basic Auth uses server-side `SEARXNG_USERNAME`/`SEARXNG_PASSWORD`.
7. `/admin` HTML is served only after server-side Telegram WebApp initData + allowlist authorization; `/admin/api/*` repeats authorization.
6. Runtime tests cannot be upgraded to green until the environment can install dependencies and access the required external services.
7. Telegram Tools now create heavy tasks through the existing operation + point-ledger + Queue producer path. `telegramUserId` is carried in task metadata for delivery. Image/document/audio/voice user flows therefore reach the Queue producer in code.
8. Telegram media delivery has an unavoidable external side-effect window: if Telegram accepts a send and the Worker crashes before persisting the delivered state, an at-least-once Queue retry can theoretically duplicate the message. The code prevents duplicate generation and duplicate billing, but exact-once external Telegram delivery cannot be guaranteed by the existing architecture without a Telegram-side idempotency primitive.
9. Search Mode now runs in `ExecutionContext.waitUntil()` for webhook requests, with 30s default / 5–45s bounded timeout and one sequential transient retry.

## Definition of Done status

| Area | Implementation | Environment verification |
|---|---|---|
| Telegram webhook/auth/dedupe | Implemented/preserved | Static only |
| User identity | Implemented | Static only |
| Chat execution | Implemented | Static only |
| Dialog lifecycle | Implemented with limits/archive helpers | Static only |
| Daily points | Implemented in reservation/reset path | Static only |
| Billing/idempotency | Implemented via existing ledger/operation layer | Static only |
| AI Gateway/providers | Implemented behind existing abstraction | Static only |
| Multiple models / provider key | Implemented via registry | Static only |
| Search Mode | Implemented as separate SearXNG pipeline | Static only |
| Search billing/config | Implemented | Static only |
| Queue processor safety | Implemented | Static only |
| Admin auth | Implemented server-side | Static only |
| Admin Mini App | Implemented sections/API/actions | Static only |
| Audit trail | Implemented | Static only |
| Backup admin commands | Implemented | Static only |
| Tests | Added/preserved | **Not executable in current environment** |
| Production runtime | Code/config prepared | **Requires credentials/services** |

## Final assessment

The continuation closes the major implementation gaps identified in the previous intermediate ZIP while deliberately retaining the original architecture. The project should not be described as end-to-end production-verified until dependency installation and external runtime verification are available.
