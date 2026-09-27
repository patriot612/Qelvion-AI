import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { SearxngClient } from '../../src/features/search/client';

describe('SearXNG cold-start retry', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => { vi.restoreAllMocks(); fetchMock.mockReset(); });

  it('retries one transient timeout sequentially and succeeds without a second client-level parallel request', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('upstream cold start'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ title: 'ok', url: 'https://example.com', content: 'evidence' }] }), { status: 200 }));
    const client = new SearxngClient('https://search.example', 50, undefined, undefined, 1);
    const result = await client.search('hello', { limit: 5 });
    expect(result).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.invocationCallOrder[0]).toBeLessThan(fetchMock.mock.invocationCallOrder[1]);
  });

  it('does not retry permanent 4xx errors', async () => {
    fetchMock.mockResolvedValue(new Response('bad request', { status: 400 }));
    const client = new SearxngClient('https://search.example', 50, undefined, undefined, 1);
    await expect(client.search('hello', { limit: 5 })).rejects.toThrow('SearXNG request failed with 400');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
