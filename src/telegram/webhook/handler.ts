import { webhookCallback, type Bot } from 'grammy';
import { hasValidTelegramWebhookSecret } from '../../core/security/telegram';

export function createWebhookHandler(bot: Bot, secret: string) {
  const handler = webhookCallback(bot, 'std/http');
  return async (request: Request): Promise<Response> => {
    if (!hasValidTelegramWebhookSecret(request, secret)) {
      return new Response('Unauthorized', { status: 401 });
    }
    return handler(request);
  };
}
