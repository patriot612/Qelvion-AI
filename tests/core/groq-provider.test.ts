import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGroqProvider } from '../../src/ai/providers/groq';

describe('Groq provider', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is unavailable without GROQ_API_KEY', () => {
    expect(createGroqProvider(undefined)).toBeNull();
  });

  it('uses the Groq OpenAI-compatible endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'groq answer' } }],
    }), { status: 200 })));

    const provider = createGroqProvider('secret')!;
    expect(provider.name).toBe('groq');
    expect(provider.supports('chat', 'openai/gpt-oss-20b')).toBe(true);
    expect(provider.supports('search-editor', 'openai/gpt-oss-20b')).toBe(true);

    const result = await provider.generateText({
      model: 'openai/gpt-oss-20b',
      prompt: 'hello',
    });

    expect(result.text).toBe('groq answer');
    expect(fetch).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
