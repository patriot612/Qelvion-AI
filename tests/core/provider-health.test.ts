import { describe, expect, it } from 'vitest';
import { getConfiguredProviderStatus } from '../../src/ai/health/providers';

describe('provider configuration status', () => {
  it('reports all supported providers without exposing secret values', () => {
    const status = getConfiguredProviderStatus({
      OPENAI_API_KEY: 'openai',
      XKIRO_API_KEY: 'xkiro',
      GROQ_API_KEY: 'groq',
      POLLINATIONS_API_KEY: 'pollinations',
    } as never);

    expect(status).toEqual({
      openai: true,
      anthropic: false,
      google: false,
      openrouter: false,
      xkiro: true,
      groq: true,
      pollinations: true,
    });
    expect(JSON.stringify(status)).not.toContain('secret');
  });
});
