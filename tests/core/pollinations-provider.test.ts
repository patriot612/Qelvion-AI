import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPollinationsProvider } from '../../src/ai/providers/pollinations';

describe('Pollinations provider', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is unavailable without POLLINATIONS_API_KEY', () => {
    expect(createPollinationsProvider(undefined)).toBeNull();
  });

  it('uses the Pollinations OpenAI-compatible image endpoint and returns a URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ url: 'https://media.pollinations.ai/image.png' }],
    }), { status: 200 })));

    const provider = createPollinationsProvider('secret')!;
    expect(provider.name).toBe('pollinations');
    expect(provider.supports('image', 'openai/gpt-image-1.5')).toBe(true);
    expect(provider.supports('chat', 'openai/gpt-image-1.5')).toBe(false);

    const result = await provider.generateMedia!('image', {
      model: 'openai/gpt-image-1.5',
      prompt: 'draw a cat',
      size: '1024x1024',
    });

    expect(result.result).toBe('https://media.pollinations.ai/image.png');
    expect(fetch).toHaveBeenCalledWith(
      'https://gen.pollinations.ai/v1/images/generations',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('accepts a base64 fallback response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ b64_json: 'YWJj' }],
    }), { status: 200 })));

    const provider = createPollinationsProvider('secret')!;
    const result = await provider.generateMedia!('image', {
      model: 'openai/gpt-image-1.5',
      prompt: 'draw',
    });

    expect(result.result).toBe('data:image/png;base64,YWJj');
  });
});
