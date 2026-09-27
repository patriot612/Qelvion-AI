export interface RoleRecord { key: string; name: string; prompt: string; pointCost: number; active: boolean; config: Record<string, unknown>; }
export class D1RoleRepository {
  constructor(private readonly db: D1Database) {}
  async getActive(key: string): Promise<RoleRecord | null> { const row = await this.db.prepare('SELECT * FROM roles WHERE key = ? AND active = 1').bind(key).first<{ key: string; name: string; prompt: string; point_cost: number; config_json: string }>(); return row ? { key: row.key, name: row.name, prompt: row.prompt, pointCost: row.point_cost, active: true, config: JSON.parse(row.config_json) } : null; }
}
