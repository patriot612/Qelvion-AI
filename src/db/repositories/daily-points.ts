import type { UserRow } from '../schema/types';

export class D1DailyPointsRepository {
  constructor(private readonly db: D1Database) {}

  async ensureCurrent(user: UserRow, dailyGrant: number): Promise<UserRow> {
    const now = new Date();
    if (new Date(user.daily_points_reset_at) > now) return user;
    const resetAt = new Date(now.getTime() + 86400000).toISOString();
    await this.db.prepare('UPDATE users SET daily_points_granted = ?, daily_points_remaining = ?, daily_points_reset_at = ?, updated_at = ? WHERE id = ?')
      .bind(dailyGrant, dailyGrant, resetAt, now.toISOString(), user.id).run();
    const updated = await this.db.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first<UserRow>();
    if (!updated) throw new Error('User disappeared during daily point reset');
    return updated;
  }
}
