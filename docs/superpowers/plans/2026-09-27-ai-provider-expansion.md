# Qelvion-AI AI Provider Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the three real external providers used by Qelvion-AI (xKiro/Qwen, Groq/gpt-oss-20b, and Pollinations/image) through the existing AI Gateway and Model Registry without rewriting the architecture.

**Architecture:** Preserve the existing `AiProvider` contract, `generateTextWithGateway()`, `generateMediaWithGateway()`, D1 Model Registry, Telegram runtime, and Queue media processor. Add thin native-fetch provider adapters, shared OpenAI-compatible transport where appropriate, provider environment types, runtime/provider factories, Admin provider health/configuration awareness, and focused tests.

**Tech Stack:** Cloudflare Workers, TypeScript, native `fetch`, D1, Cloudflare Queues, grammY, Vitest, Wrangler.

**Spec:** `Qelvion-AI_Production_Completion_Admin_Mini_App_Prompt_Search_Mode_Final.docx`

## Global Constraints

- Do not rewrite the existing project or replace working architecture.
- Preserve the existing AI Gateway and Provider Adapter abstraction.
- Preserve D1 Model Registry and `provider + provider_model_id` selection.
- Production secrets stay only in Cloudflare Secrets; never commit real values.
- Use native `fetch`; do not add heavy SDK dependencies.
- Preserve Telegram UX and existing Search Mode pipeline.
- Queue retry must not cause duplicate AI generation or double settlement.
- Implement only providers actually required by the current production flow.
- Do not edit already-applied migrations retroactively.
- Do not claim tests pass unless they are actually executed.

## Review Focus

1. Missing provider secret must make the provider unavailable without crashing the Worker.
2. xKiro and Groq must remain model-registry-driven so one API key can service multiple model IDs.
3. Pollinations image failures/timeouts must become existing DomainErrors and participate in the existing Queue retry/settlement lifecycle.
4. Search Editor must remain grounded-only even when xKiro/Groq are selected.
5. Pollinations model IDs must not be guessed from stale names; model IDs remain configurable in D1/Admin.

### Task 1: Provider transport primitives

**Files:**
- Create: `src/ai/providers/openai-compatible.ts`
- Test: `tests/ai/providers/openai-compatible.test.ts`

**Interfaces:**
- Produces `createOpenAICompatibleTextProvider(name, apiKey, baseUrl, timeoutMs): AiProvider` for text/search-editor.
- Produces `createOpenAICompatibleImageProvider(name, apiKey, baseUrl, timeoutMs): AiProvider` for image generation.

- [ ] **Step 1: Write failing tests** for successful text response parsing, 429/5xx retryability classification, non-retryable 4xx, timeout classification, and malformed response.
- [ ] **Step 2: Run** `npm test -- tests/ai/providers/openai-compatible.test.ts` and confirm failure.
- [ ] **Step 3: Implement** native `fetch` transport using OpenAI-compatible `/chat/completions` for text and `/images/generations` for image, preserving `GenerateTextInput`, `AiTextResult`, `GenerateMediaInput`, and `AiMediaResult`.
- [ ] **Step 4: Normalize** provider errors into `DomainError('PROVIDER_ERROR', ...)` with retryable=true only for timeout, 429, and 5xx.
- [ ] **Step 5: Run the focused test and confirm PASS.**

### Task 2: xKiro adapter

**Files:**
- Create: `src/ai/providers/xkiro.ts`
- Modify: `src/env.ts`
- Test: `tests/ai/providers/xkiro.test.ts`

**Interfaces:**
- Produces `createXKiroProvider(apiKey: string | undefined, timeoutMs?: number): AiProvider | null`.
- Provider name is `xkiro`.
- Default base URL is `https://api.xkiro.com/v1`.
- Supports `chat` and `search-editor`.
- Model ID is supplied entirely by Model Registry; do not hardcode Qwen model IDs.

- [ ] **Step 1: Write failing tests** for missing secret, successful Qwen-compatible completion, malformed response, timeout, 429, and 5xx.
- [ ] **Step 2: Run focused xKiro tests and confirm failure.**
- [ ] **Step 3: Implement the adapter on top of the shared OpenAI-compatible transport.**
- [ ] **Step 4: Add `XKIRO_API_KEY?: string` to `Env`.**
- [ ] **Step 5: Run focused tests and confirm PASS.**

### Task 3: Groq adapter

**Files:**
- Create: `src/ai/providers/groq.ts`
- Modify: `src/env.ts`
- Test: `tests/ai/providers/groq.test.ts`

**Interfaces:**
- Produces `createGroqProvider(apiKey: string | undefined, timeoutMs?: number): AiProvider | null`.
- Provider name is `groq`.
- Default base URL is `https://api.groq.com/openai/v1`.
- Supports `chat` and `search-editor`.
- Model ID remains registry-configurable; the expected current production model is `openai/gpt-oss-20b`.

- [ ] **Step 1: Write failing tests** for missing secret, successful completion, timeout, 429, 4xx, 5xx, and malformed response.
- [ ] **Step 2: Run focused tests and confirm failure.**
- [ ] **Step 3: Implement adapter on the shared OpenAI-compatible transport.**
- [ ] **Step 4: Add `GROQ_API_KEY?: string` to `Env`.**
- [ ] **Step 5: Run focused tests and confirm PASS.**

### Task 4: Pollinations image adapter

**Files:**
- Create: `src/ai/providers/pollinations.ts`
- Modify: `src/env.ts`
- Test: `tests/ai/providers/pollinations.test.ts`

**Interfaces:**
- Produces `createPollinationsProvider(apiKey: string | undefined, timeoutMs?: number): AiProvider | null`.
- Provider name is `pollinations`.
- Default base URL is `https://gen.pollinations.ai`.
- Supports `image`.
- The configured `provider_model_id` is authoritative; do not hardcode an unverified GPT Image model ID.

- [ ] **Step 1: Write failing tests** for missing secret, successful image URL response, data URL/base64 response handling, timeout, 429, 4xx, 5xx, and malformed response.
- [ ] **Step 2: Run focused tests and confirm failure.**
- [ ] **Step 3: Implement image generation using Pollinations' documented OpenAI-compatible image endpoint.**
- [ ] **Step 4: Add `POLLINATIONS_API_KEY?: string` to `Env`.**
- [ ] **Step 5: Run focused tests and confirm PASS.**

### Task 5: Wire providers into runtime and Queue

**Files:**
- Modify: `src/telegram/runtime.ts`
- Modify: `src/queue/consumer/processor.ts`
- Test: existing Gateway/runtime/queue provider tests plus new provider-selection coverage

**Interfaces:**
- Existing `createProviders(env: Env)` remains the single provider construction point for Telegram/runtime paths.
- Queue processor must use the same provider set.
- Provider selection remains `descriptor.provider` + `provider.supports(capability, providerModelId)`.

- [ ] **Step 1: Extend runtime/provider factory tests** to prove xKiro and Groq can service text/search-editor models and Pollinations can service image models.
- [ ] **Step 2: Modify `createProviders()` to include xKiro, Groq, and Pollinations and filter null providers exactly as existing providers are handled.
- [ ] **Step 3: Modify Queue processor provider construction identically.
- [ ] **Step 4: Run provider-selection and queue-media tests.**
- [ ] **Step 5: Confirm no Telegram handler calls a provider API directly.**

### Task 6: Model Registry/config compatibility and Admin provider status

**Files:**
- Modify: existing Admin/provider configuration modules discovered on the current branch
- Test: existing Admin/provider configuration tests plus focused provider status tests

**Interfaces:**
- Provider names exposed to Admin/configuration are exactly: `openai`, `anthropic`, `google`, `openrouter`, `xkiro`, `groq`, `pollinations`.
- Admin may display configured/unconfigured/health-safe state only; never secret values.
- Model records continue to use `provider_model_id` and `config_json`.

- [ ] **Step 1: Locate the current Admin provider configuration/status implementation on the hardening branch.**
- [ ] **Step 2: Write failing tests for the three new provider names and safe configured/unconfigured status.**
- [ ] **Step 3: Add the three providers without changing Admin Mini App authentication or model schema.**
- [ ] **Step 4: Run focused Admin tests and confirm PASS.**

### Task 7: Environment/docs/config synchronization

**Files:**
- Modify: `src/env.ts`
- Create or modify: `.dev.vars.example` if the repository does not already contain one
- Modify: `README.md` / `docs.md` only where the current hardening branch contains matching documentation
- Modify: `wrangler.jsonc` to replace the D1 placeholder with the known production D1 ID and keep the existing Queue definitions intact

- [ ] **Step 1: Add only secret names, never values: `XKIRO_API_KEY`, `GROQ_API_KEY`, `POLLINATIONS_API_KEY`.**
- [ ] **Step 2: Document `SEARXNG_BASE_URL=https://vayroai-searxng.onrender.com` as an application variable, not a secret.
- [ ] **Step 3: Replace `REPLACE_WITH_D1_DATABASE_ID` with `23d62e19-79be-4d7e-b32e-df431535fff3`.**
- [ ] **Step 4: Verify no secret values exist in Git and no existing bindings are renamed.**

### Task 8: Full verification

**Files:**
- Modify tests only if failures expose real regressions.

- [ ] **Step 1: Run** `npm run typecheck`.
- [ ] **Step 2: Run** `npm test`.
- [ ] **Step 3: Run** `npm run check`.
- [ ] **Step 4: Run the migration validation already defined by the repository/CI if available.
- [ ] **Step 5: Run live non-secret HTTP checks against the SearXNG endpoint and provider public model catalogs where possible; never send production API keys through tools.
- [ ] **Step 6: Compare the final diff against `fix/production-types-and-runtime` baseline and verify that Telegram UX, Search Mode architecture, billing, operations, and Queue state machine remain intact.
- [ ] **Step 7: Report exactly which checks passed, which could not run due environment/network/credentials, and which runtime paths remain unverified.**

