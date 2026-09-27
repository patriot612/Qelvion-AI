import { DomainError } from '../../core/errors/domain';
import type { AiProvider, GenerateTextInput } from '../gateway/types';

export function createOpenRouterProvider(apiKey: string | undefined, timeoutMs = 30000): AiProvider | null {
  if (!apiKey) return null;
  return {
    name: 'openrouter', supports: (capability) => capability === 'chat' || capability === 'search-editor',
    async generateText(input: GenerateTextInput) {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const messages = [{ role: 'system', content: input.systemPrompt ?? input.rolePrompt ?? '' }, { role: 'user', content: input.prompt }].filter((item) => item.content);
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: input.model, messages }), signal: controller.signal });
        if (!response.ok) throw new DomainError('PROVIDER_ERROR', `OpenRouter request failed with ${response.status}`, response.status === 429 || response.status >= 500);
        const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
        const text = data.choices?.[0]?.message?.content;
        if (!text) throw new DomainError('PROVIDER_ERROR', 'OpenRouter returned an empty response');
        return { text, provider: 'openrouter', model: input.model, usage: { inputTokens: data.usage?.prompt_tokens, outputTokens: data.usage?.completion_tokens } };
      } catch (error) { if (error instanceof DomainError) throw error; throw new DomainError('PROVIDER_ERROR', 'OpenRouter provider unavailable', true); }
      finally { clearTimeout(timer); }
    },
  };
}
