import { DomainError } from '../../core/errors/domain';
import type { AiProvider, GenerateTextInput } from '../gateway/types';

export function createGoogleProvider(apiKey: string | undefined, timeoutMs = 30000): AiProvider | null {
  if (!apiKey) return null;
  return {
    name: 'google', supports: (capability) => capability === 'chat' || capability === 'search-editor',
    async generateText(input: GenerateTextInput) {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(apiKey)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ systemInstruction: input.systemPrompt || input.rolePrompt ? { parts: [{ text: input.systemPrompt ?? input.rolePrompt }] } : undefined, contents: [{ role: 'user', parts: [{ text: input.prompt }] }] }), signal: controller.signal });
        if (!response.ok) throw new DomainError('PROVIDER_ERROR', `Google AI request failed with ${response.status}`, response.status === 429 || response.status >= 500);
        const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
        const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
        if (!text) throw new DomainError('PROVIDER_ERROR', 'Google AI returned an empty response');
        return { text, provider: 'google', model: input.model };
      } catch (error) { if (error instanceof DomainError) throw error; throw new DomainError('PROVIDER_ERROR', 'Google AI provider unavailable', true); }
      finally { clearTimeout(timer); }
    },
  };
}
