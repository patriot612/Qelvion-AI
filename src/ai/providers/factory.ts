import type { AiProvider } from '../gateway/types';
import type { Env } from '../../env';
import { createOpenAIProvider } from './openai';
import { createAnthropicProvider } from './anthropic';
import { createGoogleProvider } from './google';
import { createOpenRouterProvider } from './openrouter';
import { createXKiroProvider } from './xkiro';
import { createGroqProvider } from './groq';
import { createPollinationsProvider } from './pollinations';

export function createConfiguredProviders(env: Env): AiProvider[] {
  return [
    createOpenAIProvider(env.OPENAI_API_KEY),
    createAnthropicProvider(env.ANTHROPIC_API_KEY),
    createGoogleProvider(env.GOOGLE_AI_API_KEY),
    createOpenRouterProvider(env.OPENROUTER_API_KEY),
    createXKiroProvider(env.XKIRO_API_KEY),
    createGroqProvider(env.GROQ_API_KEY),
    createPollinationsProvider(env.POLLINATIONS_API_KEY),
  ].filter((provider): provider is AiProvider => Boolean(provider));
}
