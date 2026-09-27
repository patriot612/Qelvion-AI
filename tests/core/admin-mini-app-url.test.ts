import { describe, expect, it } from 'vitest';
import { resolveAdminMiniAppUrl } from '../../src/core/config/admin-mini-app-url';

describe('resolveAdminMiniAppUrl', () => {
  it('uses the explicitly configured admin URL when present', () => {
    expect(resolveAdminMiniAppUrl('https://qelvion-ai.kplenka29.workers.dev', 'https://admin.example.com/'))
      .toBe('https://admin.example.com/');
  });

  it('falls back to the current Worker origin when the setting is missing', () => {
    expect(resolveAdminMiniAppUrl('https://qelvion-ai.kplenka29.workers.dev', undefined))
      .toBe('https://qelvion-ai.kplenka29.workers.dev/admin/');
  });
});
