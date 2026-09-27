import { createOpenAICompatibleImageProvider } from './openai-compatible';
import type { AiProvider } from '../gateway/types';

const POLLINATIONS_BASE_URL = 'https://gen.pollinations.ai';

export function createPollinationsProvider(apiKey: string | undefined, timeoutMs = 60000): AiProvider | null {
  return createOpenAICompatibleImageProvider('pollinations', apiKey, POLLINATIONS_BASE_URL, timeoutMs);
}
