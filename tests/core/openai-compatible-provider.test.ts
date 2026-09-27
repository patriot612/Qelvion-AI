import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOpenAICompatibleTextProvider, createOpenAICompatibleImageProvider } from '../../src/ai/providers/openai-compatible';

describe('OpenAI-compatible provider transport', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when the API key is missing', () => {
    expect(createOpenAICompatibleTextProvider('x', undefined, 'https://example.test/v1')).toBeNull();
    expect(createOpenAICompatibleImageProvider('x', undefined, 'https://example.test/v1')).toBeNull();
  });

  it('parses a chat completion and usage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'hello' } }],
      usage: { prompt_tokens: 12, completion_tokens: 7 },
    }), { status: 200, headers: { 'content-type': 'application/json' } })));

    const provider = createOpenAICompatibleTextProvider('x', 'secret', 'https://example.test/v1')!;
    const result = await provider.generateText({ model: 'model-a', prompt: 'hi' });

    expect(result).toEqual({
      text: 'hello',
      provider: 'x',
      model: 'model-a',
      usage: { inputTokens: 12, outputTokens: 7 },
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://example.test/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it.each([429, 500])('marks HTTP %s as retryable', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status })));
    const provider = createOpenAICompatibleTextProvider('x', 'secret', 'https://example.test/v1')!;

    await expect(provider.generateText({ model: 'model-a', prompt: 'hi' })).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
      retryable: true,
    });
  });

  it('marks other 4xx responses as non-retryable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    const provider = createOpenAICompatibleTextProvider('x', 'secret', 'https://example.test/v1')!;

    await expect(provider.generateText({ model: 'model-a', prompt: 'hi' })).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
      retryable: false,
    });
  });

  it('rejects malformed text responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [] }), { status: 200 })));
    const provider = createOpenAICompatibleTextProvider('x', 'secret', 'https://example.test/v1')!;

    await expect(provider.generateText({ model: 'model-a', prompt: 'hi' })).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
    });
  });

  it('parses image URLs from the OpenAI-compatible image response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ url: 'https://cdn.example.test/image.png' }],
    }), { status: 200, headers: { 'content-type': 'application/json' } })));

    const provider = createOpenAICompatibleImageProvider('x', 'secret', 'https://example.test/v1')!;
    const result = await provider.generateMedia!('image', {
      model: 'image-a',
      prompt: 'draw a cat',
      size: '1024x1024',
    });

    expect(result).toEqual({
      result: 'https://cdn.example.test/image.png',
      provider: 'x',
      model: 'image-a',
    });
  });

  it('parses base64 image responses with an image MIME type', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ b64_json: 'YWJj' }],
    }), { status: 200 })));

    const provider = createOpenAICompatibleImageProvider('x', 'secret', 'https://example.test/v1')!;
    const result = await provider.generateMedia!('image', {
      model: 'image-a',
      prompt: 'draw',
    });

    expect(result.result).toBe('data:image/png;base64,YWJj');
    expect(result.mimeType).toBe('image/png');
  });

  it('turns aborts into retryable provider timeouts', async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = createOpenAICompatibleTextProvider('x', 'secret', 'https://example.test/v1', 1)!;

    await expect(provider.generateText({ model: 'model-a', prompt: 'hi' })).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
      retryable: true,
    });
  });
});
