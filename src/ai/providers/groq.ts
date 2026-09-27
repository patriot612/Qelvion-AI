import { createOpenAICompatibleTextProvider } from './openai-compatible';
import type { AiProvider } from '../gateway/types';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

export function createGroqProvider(apiKey: string | undefined, timeoutMs = 30000): AiProvider | null {
  return createOpenAICompatibleTextProvider('groq', apiKey, GROQ_BASE_URL, timeoutMs);
}
