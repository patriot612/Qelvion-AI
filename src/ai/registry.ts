import type { D1Database } from '@cloudflare/workers-types';
import type { AiCapability } from './gateway/types';
import type { AiModelDescriptor } from './gateway/gateway';

interface ModelRow { key: string; provider: string; provider_model_id: string; capabilities_json: string; active: number; point_cost: number; access_level: string; config_json: string; }
export class D1ModelRegistry {
  constructor(private readonly db: D1Database) {}
  async getActiveByKey(key: string): Promise<AiModelDescriptor & { pointCost: number; accessLevel: string } | null> {
    const row = await this.db.prepare('SELECT * FROM models WHERE key = ? AND active = 1').bind(key).first<ModelRow>();
    return row ? this.map(row) : null;
  }
  async getDefault(mode: 'chat' | 'search'): Promise<AiModelDescriptor & { pointCost: number; accessLevel: string } | null> {
    const configKey = mode === 'search' ? 'search.editor_model' : 'chat.model';
    const configured = await this.db.prepare('SELECT value_json FROM config WHERE key = ?').bind(configKey).first<{ value_json: string }>();
    const key = configured ? JSON.parse(configured.value_json) as string : null;
    if (key) return this.getActiveByKey(key);
    const capability = mode === 'search' ? 'search-editor' : 'chat';
    const result = await this.db.prepare('SELECT * FROM models WHERE active = 1 ORDER BY point_cost ASC, key ASC').all<ModelRow>();
    const row = result.results.find((candidate) => { try { return (JSON.parse(candidate.capabilities_json) as string[]).includes(capability); } catch { return false; } }) ?? null;
    return row ? this.map(row) : null;
  }

  async getDefaultByCapability(capability: AiCapability): Promise<AiModelDescriptor & { pointCost: number; accessLevel: string } | null> {
    const result = await this.db.prepare('SELECT * FROM models WHERE active = 1 ORDER BY point_cost ASC, key ASC').all<ModelRow>();
    const row = result.results.find((candidate) => { try { return (JSON.parse(candidate.capabilities_json) as string[]).includes(capability); } catch { return false; } }) ?? null;
    return row ? this.map(row) : null;
  }

  async getActiveByProviderModelId(provider: string, providerModelId: string): Promise<AiModelDescriptor & { pointCost: number; accessLevel: string } | null> {
    const row = await this.db.prepare('SELECT * FROM models WHERE active = 1 AND provider = ? AND provider_model_id = ? ORDER BY point_cost ASC, key ASC LIMIT 1').bind(provider, providerModelId).first<ModelRow>();
    return row ? this.map(row) : null;
  }
  async list(): Promise<Array<AiModelDescriptor & { pointCost: number; accessLevel: string }>> {
    const result = await this.db.prepare('SELECT * FROM models ORDER BY key').all<ModelRow>();
    return result.results.map((row) => this.map(row));
  }
  private map(row: ModelRow) { return { key: row.key, provider: row.provider, providerModelId: row.provider_model_id, capabilities: JSON.parse(row.capabilities_json) as AiCapability[], pointCost: row.point_cost, accessLevel: row.access_level }; }
}
