import { describe, expect, it } from 'vitest';
import { hasValidTelegramWebhookSecret } from '../../src/core/security/telegram';

describe('telegram webhook security', () => {
  it('accepts the exact configured secret header', () => {
    const request = new Request('https://example.test', {
      headers: { 'X-Telegram-Bot-Api-Secret-Token': 'secret' },
    });
    expect(hasValidTelegramWebhookSecret(request, 'secret')).toBe(true);
  });

  it('rejects a missing or mismatched secret', () => {
    expect(hasValidTelegramWebhookSecret(new Request('https://example.test'), 'secret')).toBe(false);
  });
});
