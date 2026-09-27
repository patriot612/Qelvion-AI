import { describe, expect, it } from 'vitest';
import { isCallbackTokenUsable } from '../../src/core/security/callback-token';

describe('callback token ownership', () => {
  it('requires matching owner and non-expired token', () => {
    expect(isCallbackTokenUsable({ token: 't', userId: 'u', action: 'x', expiresAt: '2026-09-28T00:00:00.000Z' }, 'u', new Date('2026-09-27T23:00:00.000Z'))).toBe(true);
    expect(isCallbackTokenUsable({ token: 't', userId: 'u', action: 'x', expiresAt: '2026-09-26T00:00:00.000Z' }, 'u', new Date('2026-09-27T23:00:00.000Z'))).toBe(false);
    expect(isCallbackTokenUsable({ token: 't', userId: 'u', action: 'x', expiresAt: '2026-09-28T00:00:00.000Z' }, 'other', new Date('2026-09-27T23:00:00.000Z'))).toBe(false);
  });
});
