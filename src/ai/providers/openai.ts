import { DomainError } from '../../core/errors/domain';
import type { AiProvider, GenerateMediaInput, GenerateTextInput } from '../gateway/types';

export function createOpenAIProvider(apiKey: string | undefined, timeoutMs = 30000): AiProvider | null {
  if (!apiKey) return null;
  return {
    name: 'openai',
    supports: (capability, _model) => capability === 'chat' || capability === 'search-editor' || capability === 'image' || capability === 'audio' || capability === 'document',
    async generateText(input: GenerateTextInput) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: input.model, instructions: input.systemPrompt ?? input.rolePrompt, input: input.prompt }),
          signal: controller.signal,
        });
        if (!response.ok) {
          const retryable = response.status === 429 || response.status >= 500;
          throw new DomainError('PROVIDER_ERROR', `OpenAI request failed with ${response.status}`, retryable);
        }
        const data = await response.json() as { output_text?: string; usage?: { input_tokens?: number; output_tokens?: number } };
        if (!data.output_text) throw new DomainError('PROVIDER_ERROR', 'OpenAI returned an empty response');
        const usage = data.usage
          ? {
              ...(data.usage.input_tokens === undefined ? {} : { inputTokens: data.usage.input_tokens }),
              ...(data.usage.output_tokens === undefined ? {} : { outputTokens: data.usage.output_tokens }),
            }
          : undefined;
        return {
          text: data.output_text,
          provider: 'openai',
          model: input.model,
          ...(usage && Object.keys(usage).length > 0 ? { usage } : {}),
        };
      } catch (error) {
        if (error instanceof DomainError) throw error;
        throw new DomainError('PROVIDER_ERROR', error instanceof Error && error.name === 'AbortError' ? 'OpenAI request timed out' : 'OpenAI provider unavailable', true);
      } finally { clearTimeout(timer); }
    },
    async generateMedia(capability, input: GenerateMediaInput) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        if (capability === 'image') {
          const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: input.model, prompt: input.prompt, n: 1, size: input.size ?? '1024x1024' }),
            signal: controller.signal,
          });
          if (!response.ok) throw providerError('Image', response.status);
          const body = await response.json() as { data?: Array<{ url?: string; b64_json?: string }> };
          const item = body.data?.[0];
          if (item?.url) return { result: item.url, provider: 'openai', model: input.model };
          if (item?.b64_json) return { result: `data:image/png;base64,${item.b64_json}`, provider: 'openai', model: input.model, mimeType: 'image/png' };
          throw new DomainError('PROVIDER_ERROR', 'Image provider returned no output');
        }

        const text = input.input ?? input.prompt;
        const format = input.format ?? 'mp3';
        if (capability === 'audio') {
          const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: input.model, input: text, voice: input.voice ?? 'alloy', format }),
            signal: controller.signal,
          });
          if (!response.ok) throw providerError('Audio', response.status);
          const bytes = new Uint8Array(await response.arrayBuffer());
          const mimeType = format === 'opus' ? 'audio/ogg' : 'audio/mpeg';
          return { result: `data:${mimeType};base64,${toBase64(bytes)}`, provider: 'openai', model: input.model, mimeType };
        }

        const response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: input.model, input: text, instructions: 'Process the supplied document task and return the requested textual result. Do not invent missing content.' }),
          signal: controller.signal,
        });
        if (!response.ok) throw providerError('Document', response.status);
        const body = await response.json() as { output_text?: string };
        if (!body.output_text) throw new DomainError('PROVIDER_ERROR', 'Document provider returned no output');
        return { result: body.output_text, provider: 'openai', model: input.model, mimeType: 'text/plain' };
      } catch (error) {
        if (error instanceof DomainError) throw error;
        throw new DomainError('PROVIDER_ERROR', error instanceof Error && error.name === 'AbortError' ? 'OpenAI media request timed out' : 'OpenAI media provider unavailable', true);
      } finally { clearTimeout(timer); }
    },
  };
}

function providerError(kind: string, status: number): DomainError {
  return new DomainError('PROVIDER_ERROR', `${kind} provider failed with ${status}`, status === 429 || status >= 500);
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
