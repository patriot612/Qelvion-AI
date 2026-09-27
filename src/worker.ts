import { createTelegramBot } from './telegram/api/client';
import { createWebhookHandler } from './telegram/webhook/handler';
import { configureTelegramRoutes } from './telegram/updates/router';
import type { Env } from './env';
import type { HeavyTaskMessage } from './queue/tasks/types';
import { consumeHeavyTasks } from './queue/consumer/worker';
import { D1HeavyTaskProcessor } from './queue/consumer/processor';
import { handleAdminApi, adminHtml, authorizeAdminRequest } from './telegram/admin';
import { isDuplicateUpdate } from './telegram/updates/dedupe';

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
    if (await isDuplicateUpdate(env.QELVION_DB, body.update_id)) return new Response('OK', { status: 200 });
    const bot = createTelegramBot(env.TELEGRAM_BOT_TOKEN);
    configureTelegramRoutes(bot, env, ctx);
    return createWebhookHandler(bot, env.TELEGRAM_WEBHOOK_SECRET)(request);
  },

  async queue(batch: MessageBatch<HeavyTaskMessage>, env: Env): Promise<void> {
    const processor = new D1HeavyTaskProcessor(env);
    await consumeHeavyTasks(batch, processor);
  },
} satisfies ExportedHandler<Env>;
