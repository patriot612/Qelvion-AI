import { createTelegramBot } from './telegram/api/client';
import { createWebhookHandler } from './telegram/webhook/handler';
import { configureTelegramRoutes } from './telegram/updates/router';
import type { Env } from './env';
import type { HeavyTaskMessage } from './queue/tasks/types';
import { consumeHeavyTasks } from './queue/consumer/worker';
import { D1HeavyTaskProcessor } from './queue/consumer/processor';
import { handleAdminApi, adminHtml, authorizeAdminRequest } from './telegram/admin';
import { claimUpdate, completeUpdate, releaseUpdate } from './telegram/updates/dedupe';
import { hasValidTelegramWebhookSecret } from './core/security/telegram';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/admin/' || url.pathname === '/admin') {
      try { await authorizeAdminRequest(request, env); return adminHtml(); } catch (error) { if (error instanceof Response) return error; return new Response('Forbidden', { status: 403 }); }
    }
    if (url.pathname.startsWith('/admin/api/')) return handleAdminApi(request, env);
    if (url.pathname !== '/telegram/webhook') return new Response('Qelvion-AI', { status: 200 });
    const body = await request.clone().json().catch(() => null) as { update_id?: number } | null;
    if (!body || typeof body.update_id !== 'number') return new Response('Bad Request', { status: 400 });
    if (!hasValidTelegramWebhookSecret(request, env.TELEGRAM_WEBHOOK_SECRET)) {
      return new Response('Unauthorized', { status: 401 });
    }
    if (!(await claimUpdate(env.QELVION_DB, body.update_id))) return new Response('OK', { status: 200 });
    const bot = createTelegramBot(env.TELEGRAM_BOT_TOKEN);
    configureTelegramRoutes(bot, env, ctx);
    try {
      const response = await createWebhookHandler(bot, env.TELEGRAM_WEBHOOK_SECRET)(request);
      if (response.ok) await completeUpdate(env.QELVION_DB, body.update_id);
      else await releaseUpdate(env.QELVION_DB, body.update_id);
      return response;
    } catch (error) {
      await releaseUpdate(env.QELVION_DB, body.update_id);
      throw error;
    }
  },

  async queue(batch, env): Promise<void> {
    const processor = new D1HeavyTaskProcessor(env);
    await consumeHeavyTasks(batch, processor);
  },
} satisfies ExportedHandler<Env, HeavyTaskMessage>;
