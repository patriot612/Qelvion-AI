import { describe, expect, it } from 'vitest';
import { createConfiguredProviders } from '../../src/ai/providers/factory';

describe('configured provider factory', () => {
  it('constructs all providers from the available secrets', () => {
    const providers = createConfiguredProviders({
      OPENAI_API_KEY: 'openai',
      ANTHROPIC_API_KEY: 'anthropic',
      GOOGLE_AI_API_KEY: 'google',
      OPENROUTER_API_KEY: 'openrouter',
      XKIRO_API_KEY: 'xkiro',
      GROQ_API_KEY: 'groq',
      POLLINATIONS_API_KEY: 'pollinations',
    } as never);

    expect(providers.map((provider) => provider.name)).toEqual([
      'openai',
      'anthropic',
      'google',
      'openrouter',
      'xkiro',
      'groq',
      'pollinations',
    ]);
  });

  it('omits providers whose secrets are absent', () => {
    const providers = createConfiguredProviders({ XKIRO_API_KEY: 'xkiro' } as never);
    expect(providers.map((provider) => provider.name)).toEqual(['xkiro']);
  });
});
