import { describe, expect, it, vi } from 'vitest';
import { claimUpdate, completeUpdate, releaseUpdate } from '../../src/telegram/updates/dedupe';

function createFakeDb() {
  const rows = new Map<number, { status: 'processing' | 'completed'; processed_at: string }>();
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes('SELECT status, processed_at')) {
                return (rows.get(Number(args[0])) ?? null) as T | null;
              }
              return null;
            },
            async run() {
              if (sql.includes('INSERT INTO processed_updates')) {
                const updateId = Number(args[0]);
                if (rows.has(updateId)) throw new Error('UNIQUE constraint failed');
                rows.set(updateId, { status: 'processing', processed_at: String(args[1]) });
                return { success: true, meta: { changes: 1 } };
              }
              if (sql.includes('SET status = \'completed\'')) {
                const updateId = Number(args[1]);
                const row = rows.get(updateId);
                if (!row || row.status !== 'processing') return { success: true, meta: { changes: 0 } };
                row.status = 'completed';
                row.processed_at = String(args[0]);
                return { success: true, meta: { changes: 1 } };
              }
              if (sql.includes('DELETE FROM processed_updates')) {
                const updateId = Number(args[0]);
                const row = rows.get(updateId);
                if (row?.status !== 'processing') return { success: true, meta: { changes: 0 } };
                rows.delete(updateId);
                return { success: true, meta: { changes: 1 } };
              }
              if (sql.includes('UPDATE processed_updates SET processed_at')) {
                const updateId = Number(args[1]);
                const expected = String(args[2]);
                const row = rows.get(updateId);
                if (!row || row.status !== 'processing' || row.processed_at !== expected) return { success: true, meta: { changes: 0 } };
                row.processed_at = String(args[0]);
                return { success: true, meta: { changes: 1 } };
              }
              return { success: true, meta: { changes: 0 } };
            },
          };
        },
      };
    },
  };
  return db as unknown as D1Database;
}

describe('telegram update deduplication', () => {
  it('claims once and completes without reprocessing completed updates', async () => {
    const db = createFakeDb();
    expect(await claimUpdate(db, 101)).toBe(true);
    expect(await claimUpdate(db, 101)).toBe(false);
    await completeUpdate(db, 101);
    expect(await claimUpdate(db, 101)).toBe(false);
  });

  it('releases a failed claim so Telegram can retry', async () => {
    const db = createFakeDb();
    expect(await claimUpdate(db, 202)).toBe(true);
    await releaseUpdate(db, 202);
    expect(await claimUpdate(db, 202)).toBe(true);
  });
});
