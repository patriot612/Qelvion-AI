
import { describe, expect, it } from 'vitest';
import { D1UserRepository } from '../../src/db/repositories/users';

describe('user creation concurrency', () => {
  it('recovers from a UNIQUE telegram_user_id race by reading the winner', async () => {
    const winner = { id: 'winner', telegram_user_id: 123, language: 'ru', status: 'active', balance_points: 0, daily_points_granted: 50, daily_points_remaining: 50, daily_points_reset_at: 'now', subscription_status: 'free', active_mode: 'chat', pending_task_type: null, created_at: 'now', updated_at: 'now' } as const;
    let reads = 0;
    const db = {
      prepare(sql: string) {
        return {
          bind() { return this; },
          async first() { reads += 1; return reads === 1 ? null : winner; },
          async run() { throw new Error('UNIQUE constraint failed: users.telegram_user_id'); },
        };
      },
    } as unknown as D1Database;
    const repo = new D1UserRepository(db);
    await expect(repo.getOrCreate(123)).resolves.toEqual(winner);
  });
});
