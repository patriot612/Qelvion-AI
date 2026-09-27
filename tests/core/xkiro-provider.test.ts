import { afterEach, describe, expect, it, vi } from 'vitest';
import { createXKiroProvider } from '../../src/ai/providers/xkiro';

describe('xKiro provider', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is unavailable without XKIRO_API_KEY', () => {
    expect(createXKiroProvider(undefined)).toBeNull();
  });

  it('uses the xKiro OpenAI-compatible endpoint for text generation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'qwen answer' } }],
    }), { status: 200 })));

    const provider = createXKiroProvider('secret')!;
    expect(provider.name).toBe('xkiro');
    expect(provider.supports('chat', 'qwen/qwen3.8-max')).toBe(true);
    expect(provider.supports('search-editor', 'qwen/qwen3.8-max')).toBe(true);

    const result = await provider.generateText({
      model: 'qwen/qwen3.8-max',
      prompt: 'hello',
    });

    expect(result.text).toBe('qwen answer');
    expect(fetch).toHaveBeenCalledWith(
      'https://api.xkiro.com/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
