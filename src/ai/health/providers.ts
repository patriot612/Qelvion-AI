import type { Env } from '../../env';

export interface ProviderConfigurationStatus {
  openai: boolean;
  anthropic: boolean;
  google: boolean;
  openrouter: boolean;
  xkiro: boolean;
  groq: boolean;
  pollinations: boolean;
}

export function getConfiguredProviderStatus(env: Env): ProviderConfigurationStatus {
  return {
    openai: Boolean(env.OPENAI_API_KEY),
    anthropic: Boolean(env.ANTHROPIC_API_KEY),
    google: Boolean(env.GOOGLE_AI_API_KEY),
    openrouter: Boolean(env.OPENROUTER_API_KEY),
    xkiro: Boolean(env.XKIRO_API_KEY),
    groq: Boolean(env.GROQ_API_KEY),
    pollinations: Boolean(env.POLLINATIONS_API_KEY),
  };
}
