import type { UserRow } from '../schema/types';

export class D1UserRepository {
  constructor(private readonly db: D1Database) {}
  async findByTelegramId(telegramUserId: number): Promise<UserRow | null> {
    return this.db.prepare('SELECT * FROM users WHERE telegram_user_id = ?').bind(telegramUserId).first<UserRow>();
  }
  async setMode(userId: string, mode: 'chat' | 'search'): Promise<void> {
    await this.db.prepare('UPDATE users SET active_mode = ?, updated_at = ? WHERE id = ?').bind(mode, new Date().toISOString(), userId).run();
  }
  async setPendingTask(userId: string, taskType: UserRow['pending_task_type']): Promise<void> {
    await this.db.prepare('UPDATE users SET pending_task_type = ?, updated_at = ? WHERE id = ?').bind(taskType, new Date().toISOString(), userId).run();
  }
  async findById(userId: string): Promise<UserRow | null> {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<UserRow>();
  }
  async getOrCreate(telegramUserId: number): Promise<UserRow> {
    const existing = await this.findByTelegramId(telegramUserId);
    if (existing) return existing;
    const now = new Date().toISOString();
    const user: UserRow = { id: crypto.randomUUID(), telegram_user_id: telegramUserId, language: 'ru', status: 'active', balance_points: 0, daily_points_granted: 50, daily_points_remaining: 50, daily_points_reset_at: now, subscription_status: 'free', active_mode: 'chat', pending_task_type: null, created_at: now, updated_at: now };
    try {
      await this.db.prepare(`INSERT INTO users (id, telegram_user_id, language, status, balance_points, daily_points_granted, daily_points_remaining, daily_points_reset_at, subscription_status, active_mode, pending_task_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(user.id, user.telegram_user_id, user.language, user.status, user.balance_points, user.daily_points_granted, user.daily_points_remaining, user.daily_points_reset_at, user.subscription_status, user.active_mode, user.pending_task_type, user.created_at, user.updated_at).run();
      return user;
    } catch (error) {
      if (error instanceof Error && /UNIQUE|constraint/i.test(error.message)) {
        const winner = await this.findByTelegramId(telegramUserId);
        if (winner) return winner;
      }
      throw error;
    }
  }
}
