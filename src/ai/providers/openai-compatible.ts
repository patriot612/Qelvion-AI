import { DomainError } from '../../core/errors/domain';
import type { AiProvider, AiMediaResult, AiTextResult, GenerateMediaInput, GenerateTextInput } from '../gateway/types';

type ChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
};

type ImageResponse = {
  data?: Array<{
    url?: string;
    b64_json?: string;
  }>;
};

export function createOpenAICompatibleTextProvider(
  name: string,
  apiKey: string | undefined,
  baseUrl: string,
  timeoutMs = 30000,
): AiProvider | null {
  if (!apiKey) return null;

  return {
    name,
    supports: (capability) => capability === 'chat' || capability === 'search-editor',
    async generateText(input: GenerateTextInput): Promise<AiTextResult> {
      const data = await requestJson<ChatResponse>(
        baseUrl.replace(/\/$/, '') + '/chat/completions',
        apiKey,
        {
          model: input.model,
          messages: [
            ...(input.systemPrompt ?? input.rolePrompt
              ? [{ role: 'system', content: input.systemPrompt ?? input.rolePrompt ?? '' }]
              : []),
            { role: 'user', content: input.prompt },
          ],
        },
        input.timeoutMs ?? timeoutMs,
      );

      const rawContent = data.choices?.[0]?.message?.content;
      const text = typeof rawContent === 'string'
        ? rawContent
        : Array.isArray(rawContent)
          ? rawContent.map((part) => part.text ?? '').join('')
          : '';
      if (!text.trim()) throw new DomainError('PROVIDER_ERROR', name + ' returned an empty response');

      const usage = data.usage
        ? {
            ...(data.usage.prompt_tokens === undefined ? {} : { inputTokens: data.usage.prompt_tokens }),
            ...(data.usage.completion_tokens === undefined ? {} : { outputTokens: data.usage.completion_tokens }),
          }
        : undefined;

      return {
        text,
        provider: name,
        model: input.model,
        ...(usage && Object.keys(usage).length > 0 ? { usage } : {}),
      };
    },
  };
}

export function createOpenAICompatibleImageProvider(
  name: string,
  apiKey: string | undefined,
  baseUrl: string,
  timeoutMs = 60000,
): AiProvider | null {
  if (!apiKey) return null;

  return {
    name,
    supports: (capability) => capability === 'image',
    async generateText(): Promise<AiTextResult> {
      throw new DomainError('PROVIDER_ERROR', name + ' does not implement text generation');
    },
    async generateMedia(_capability, input: GenerateMediaInput): Promise<AiMediaResult> {
      const data = await requestJson<ImageResponse>(
        baseUrl.replace(/\/$/, '') + '/images/generations',
        apiKey,
        {
          model: input.model,
          prompt: input.prompt,
          n: 1,
          size: input.size ?? '1024x1024',
          response_format: 'url',
        },
        timeoutMs,
      );

      const item = data.data?.[0];
      if (item?.url) return { result: item.url, provider: name, model: input.model };
      if (item?.b64_json) return { result: 'data:image/png;base64,' + item.b64_json, provider: name, model: input.model, mimeType: 'image/png' };
      throw new DomainError('PROVIDER_ERROR', name + ' returned no image output');
    },
  };
}

async function requestJson<T>(
  url: string,
  apiKey: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new DomainError(
        'PROVIDER_ERROR',
        'OpenAI-compatible provider request failed with ' + response.status,
        response.status === 429 || response.status >= 500,
      );
    }

    try {
      return await response.json() as T;
    } catch {
      throw new DomainError('PROVIDER_ERROR', 'Provider returned malformed JSON');
    }
  } catch (error) {
    if (error instanceof DomainError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new DomainError('PROVIDER_ERROR', 'Provider request timed out', true);
    }
    throw new DomainError('PROVIDER_ERROR', 'Provider unavailable', true);
  } finally {
    clearTimeout(timer);
  }
}
