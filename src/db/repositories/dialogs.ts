import type { DialogLimits } from '../../features/dialogs/limits';
import { DomainError } from '../../core/errors/domain';

export interface DialogRecord { dialogId: string; userId: string; title: string; isArchived: boolean; messageCount: number; }
export class D1DialogRepository {
  constructor(private readonly db: D1Database) {}
  async getActive(userId: string): Promise<DialogRecord | null> {
    const row = await this.db.prepare('SELECT * FROM dialogs WHERE user_id = ? AND is_archived = 0 ORDER BY updated_at DESC LIMIT 1').bind(userId).first<DialogDbRow>();
    return row ? map(row) : null;
  }
  async create(userId: string, title = 'Новый диалог'): Promise<DialogRecord> {
    const now = new Date().toISOString(); const dialogId = crypto.randomUUID();
    await this.db.prepare('INSERT INTO dialogs (dialog_id, user_id, title, is_archived, message_count, created_at, updated_at) VALUES (?, ?, ?, 0, 0, ?, ?)').bind(dialogId, userId, title, now, now).run();
    return { dialogId, userId, title, isArchived: false, messageCount: 0 };
  }
  async ensureActive(userId: string, limits: DialogLimits): Promise<DialogRecord> {
    const active = await this.getActive(userId); if (active) return active;
    const count = await this.db.prepare('SELECT COUNT(*) AS count FROM dialogs WHERE user_id = ? AND is_archived = 0').bind(userId).first<{count:number}>();
    if ((count?.count ?? 0) >= limits.activeLimit) throw new Error('Active dialog limit reached');
    return this.create(userId);
  }
  async claimTurn(dialogId: string, token: string, leaseMs = 120000): Promise<void> {
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + leaseMs).toISOString();
    const result = await this.db.prepare(`UPDATE dialogs SET turn_lock_token = ?, turn_lock_expires_at = ?, updated_at = ? WHERE dialog_id = ? AND is_archived = 0 AND (turn_lock_token IS NULL OR turn_lock_expires_at IS NULL OR turn_lock_expires_at <= ?)`)
      .bind(token, expiresAt, now, dialogId, now).run();
    if ((result.meta?.changes ?? 0) !== 1) throw new DomainError('CONFLICT', 'Dialog is busy with another request');
  }
  async releaseTurn(dialogId: string, token: string): Promise<void> {
    await this.db.prepare('UPDATE dialogs SET turn_lock_token = NULL, turn_lock_expires_at = NULL, updated_at = ? WHERE dialog_id = ? AND turn_lock_token = ?')
      .bind(new Date().toISOString(), dialogId, token).run();
  }
  async addMessage(dialogId: string, role: 'user' | 'assistant', content: string, limits: DialogLimits): Promise<void> {
    const row = await this.db.prepare('SELECT message_count FROM dialogs WHERE dialog_id = ? AND is_archived = 0').bind(dialogId).first<{ message_count: number }>();
    if (!row || row.message_count >= limits.messagesPerDialog) throw new Error('Dialog message limit reached');
    const now = new Date().toISOString();
    await this.db.batch([
      this.db.prepare('INSERT INTO dialog_messages (message_id, dialog_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(), dialogId, role, content, now),
      this.db.prepare('UPDATE dialogs SET message_count = message_count + 1, updated_at = ? WHERE dialog_id = ?').bind(now, dialogId),
    ]);
  }
  async history(dialogId: string, limit = 20): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const result = await this.db.prepare('SELECT role, content FROM dialog_messages WHERE dialog_id = ? ORDER BY created_at DESC LIMIT ?').bind(dialogId, limit).all<{ role: 'user' | 'assistant'; content: string }>();
    return result.results.reverse();
  }
}
interface DialogDbRow { dialog_id: string; user_id: string; title: string; is_archived: number; message_count: number; }
function map(row: DialogDbRow): DialogRecord { return { dialogId: row.dialog_id, userId: row.user_id, title: row.title, isArchived: row.is_archived === 1, messageCount: row.message_count }; }

