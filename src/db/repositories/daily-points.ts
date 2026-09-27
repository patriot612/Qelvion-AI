import type { UserRow } from '../schema/types';

export class D1DailyPointsRepository {
  constructor(private readonly db: D1Database) {}

  async ensureCurrent(user: UserRow, dailyGrant: number): Promise<UserRow> {
    const now = new Date();
    if (new Date(user.daily_points_reset_at) > now) return user;
    const nowIso = now.toISOString();
    const resetAt = new Date(now.getTime() + 86400000).toISOString();
    const result = await this.db.prepare('UPDATE users SET daily_points_granted = ?, daily_points_remaining = ?, daily_points_reset_at = ?, updated_at = ? WHERE id = ? AND daily_points_reset_at <= ? AND daily_points_reset_at = ?')
      .bind(dailyGrant, dailyGrant, resetAt, nowIso, user.id, nowIso, user.daily_points_reset_at).run();
    if ((result.meta?.changes ?? 0) === 0) {
      const current = await this.db.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first<UserRow>();
      if (current) return current;
    }
    const updated = await this.db.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first<UserRow>();
    if (!updated) throw new Error('User disappeared during daily point reset');
    return updated;
  }
}
