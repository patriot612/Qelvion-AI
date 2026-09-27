import { describe, expect, it } from 'vitest';
import { assertNonNegativeBalance, calculateOperationSettlement } from '../../src/core/billing/ledger';

describe('point ledger invariants', () => {
  it('rejects a negative balance', () => {
    expect(() => assertNonNegativeBalance(-1)).toThrow();
  });

  it('releases the reservation when an operation fails', () => {
    expect(calculateOperationSettlement(12, false)).toEqual({ capture: 0, release: 12 });
  });

  it('captures the reservation when an operation succeeds', () => {
    expect(calculateOperationSettlement(12, true)).toEqual({ capture: 12, release: 0 });
  });
});


it('does not insert a reserve ledger entry when the guarded UPDATE changes zero rows', async () => {
  const pointModule = await import('../../src/db/repositories/points');
  const prepareCalls: any[] = [];
  const db = {
    prepare(sql: string) {
      const call: any = { sql, bindArgs: [] as unknown[] };
      prepareCalls.push(call);
      call.bind = (...args: unknown[]) => { call.bindArgs = args; return call; };
      call.first = async () => sql.startsWith('SELECT entry_id') ? null : sql.startsWith('SELECT balance_points') ? { balance_points: 0, daily_points_remaining: 10 } : null;
      call.run = async () => ({ success: true, meta: { changes: 0 } });
      return call;
    },
    batch: async () => [
      { success: true, meta: { changes: 0 } },
      { success: true, meta: { changes: 0 } },
      { success: true, meta: { changes: 0 } },
    ],
  } as unknown as D1Database;
  const repo = new pointModule.D1PointRepository(db);
  await expect(repo.reserve('u-1', 'op-1', 5)).rejects.toMatchObject({ code: 'CONFLICT' });
  expect(prepareCalls.some((call) => String(call.sql).includes('point_reservation_token'))).toBe(true);
});
