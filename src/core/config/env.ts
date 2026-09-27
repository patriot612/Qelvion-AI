import { DomainError } from '../errors/domain';
import type { Env } from '../../env';

export function requireRuntimeConfig(env: Env): Pick<Env, 'TELEGRAM_BOT_TOKEN' | 'TELEGRAM_WEBHOOK_SECRET'> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) {
    throw new DomainError('INVALID_INPUT', 'Telegram runtime configuration is incomplete');
  }
  return {
    TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_WEBHOOK_SECRET: env.TELEGRAM_WEBHOOK_SECRET,
  };
}
