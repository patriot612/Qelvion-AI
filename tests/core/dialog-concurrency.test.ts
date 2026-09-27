import { describe, expect, it } from 'vitest';
import { D1DialogRepository } from '../../src/db/repositories/dialogs';

describe('dialog turn serialization', () => {
  it('rejects a second concurrent turn while a lease is active', async () => {
    const db = {
      prepare(_sql: string) {
        return { bind() { return this; }, async run() { return { success: true, meta: { changes: 0 } }; } };
      },
    } as unknown as D1Database;
    const repo = new D1DialogRepository(db);
    await expect(repo.claimTurn('dialog-1', 'token-1')).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
