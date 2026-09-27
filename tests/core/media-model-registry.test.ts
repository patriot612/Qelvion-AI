import { describe, expect, it } from 'vitest';
import { D1ModelRegistry } from '../../src/ai/registry';

describe('media model registry', () => {
  it('does not hardcode OpenAI when selecting a capability model', async () => {
    const db = {
      prepare(sql: string) {
        return {
          bind() { return this; },
          async all() {
            expect(sql).not.toContain('provider = ?');
            return { results: [{ key: 'google-image', provider: 'google', provider_model_id: 'image-1', capabilities_json: '["image"]', active: 1, point_cost: 1, access_level: 'daily', config_json: '{}' }] };
          },
        };
      },
    } as unknown as D1Database;
    const registry = new D1ModelRegistry(db);
    await expect(registry.getDefaultByCapability('image')).resolves.toMatchObject({ provider: 'google', providerModelId: 'image-1' });
  });
});
