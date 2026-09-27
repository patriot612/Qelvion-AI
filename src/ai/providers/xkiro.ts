import { createOpenAICompatibleTextProvider } from './openai-compatible';
import type { AiProvider } from '../gateway/types';

const XKIRO_BASE_URL = 'https://api.xkiro.com/v1';

export function createXKiroProvider(apiKey: string | undefined, timeoutMs = 30000): AiProvider | null {
  return createOpenAICompatibleTextProvider('xkiro', apiKey, XKIRO_BASE_URL, timeoutMs);
}
