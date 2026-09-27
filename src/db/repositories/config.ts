export class D1ConfigRepository {
  constructor(private readonly db: D1Database) {}

  async getJson<T>(key: string, fallback: T): Promise<T> {
    const row = await this.db.prepare('SELECT value_json FROM config WHERE key = ?').bind(key).first<{ value_json: string }>();
    if (!row) return fallback;
    return JSON.parse(row.value_json) as T;
  }

  async setJson<T>(key: string, value: T): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare(`
      INSERT INTO config (key, value_json, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
    `).bind(key, JSON.stringify(value), now).run();
  }
}
