import { describe, expect, it } from 'vitest';
import { applyDailyReset } from '../../src/features/account/daily-points';

describe('daily points', () => {
  it('resets only when reset time has elapsed', () => {
    const now = new Date('2026-09-27T00:00:00.000Z');
    expect(applyDailyReset({ granted: 50, remaining: 10, resetAt: '2026-09-27T01:00:00.000Z' }, now, 50).remaining).toBe(10);
    expect(applyDailyReset({ granted: 50, remaining: 10, resetAt: '2026-09-26T23:00:00.000Z' }, now, 60).remaining).toBe(60);
  });
});
