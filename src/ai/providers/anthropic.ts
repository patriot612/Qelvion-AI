import { DomainError } from '../../core/errors/domain';
import type { AiProvider, GenerateTextInput } from '../gateway/types';

export function createAnthropicProvider(apiKey: string | undefined, timeoutMs = 30000): AiProvider | null {
  if (!apiKey) return null;
  return {
    name: 'anthropic', supports: (capability) => capability === 'chat' || capability === 'search-editor',
    async generateText(input: GenerateTextInput) {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify({ model: input.model, max_tokens: 2000, system: input.systemPrompt ?? input.rolePrompt, messages: [{ role: 'user', content: input.prompt }] }), signal: controller.signal });
        if (!response.ok) throw new DomainError('PROVIDER_ERROR', `Anthropic request failed with ${response.status}`, response.status === 429 || response.status >= 500);
        const data = await response.json() as { content?: Array<{ type: string; text?: string }> };
        const text = data.content?.find((item) => item.type === 'text')?.text;
        if (!text) throw new DomainError('PROVIDER_ERROR', 'Anthropic returned an empty response');
        return { text, provider: 'anthropic', model: input.model };
      } catch (error) { if (error instanceof DomainError) throw error; throw new DomainError('PROVIDER_ERROR', 'Anthropic provider unavailable', true); }
      finally { clearTimeout(timer); }
    },
  };
}
