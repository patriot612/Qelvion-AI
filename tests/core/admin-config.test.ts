import { describe, expect, it } from 'vitest';
import { validateAdminConfigUpdate } from '../../src/telegram/admin';

describe('admin config validation', () => {
  it('rejects invalid search runtime values', () => {
    expect(() => validateAdminConfigUpdate('search.price', -1, ['model'])).toThrow();
    expect(() => validateAdminConfigUpdate('search.results_limit', 0, ['model'])).toThrow();
    expect(() => validateAdminConfigUpdate('search.timeout_ms', 4000, ['model'])).toThrow();
    expect(() => validateAdminConfigUpdate('search.safesearch', 3, ['model'])).toThrow();
  });

  it('requires configured active models for model selector keys', () => {
    expect(() => validateAdminConfigUpdate('search.editor_model', 'missing', [])).toThrow();
    expect(() => validateAdminConfigUpdate('chat.model', 123, ['chat-model'])).toThrow();
    expect(() => validateAdminConfigUpdate('search.editor_model', 'search-model', ['search-model'])).not.toThrow();
  });

  it('allows nullable search time range and boolean enable switch', () => {
    expect(() => validateAdminConfigUpdate('search.enabled', true, [])).not.toThrow();
    expect(() => validateAdminConfigUpdate('search.time_range', null, [])).not.toThrow();
    expect(() => validateAdminConfigUpdate('search.time_range', 'week', [])).not.toThrow();
  });
});
