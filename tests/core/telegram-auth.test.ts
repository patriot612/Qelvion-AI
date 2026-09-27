import { describe, expect, it } from 'vitest';
import { isAdminTelegramId, verifyTelegramWebAppInitData } from '../../src/core/security/telegram';

describe('Telegram WebApp auth', () => {
  it('parses admin allowlist without exposing it to clients', () => { expect(isAdminTelegramId('1,2', 2)).toBe(true); expect(isAdminTelegramId('1,2', 3)).toBe(false); });
  it('rejects missing initData', async () => { await expect(verifyTelegramWebAppInitData('', 'token')).rejects.toThrow(); });
});
