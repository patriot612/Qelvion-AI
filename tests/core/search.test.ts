import { describe, expect, it } from 'vitest';
import { normalizeSearchResults } from '../../src/features/search/client';
import { runSearchEditor } from '../../src/features/search/editor';

describe('search pipeline', () => {
  it('normalizes, deduplicates and ranks only real HTTP source URLs', () => {
    const results = normalizeSearchResults([
      { title: 'A', url: 'https://example.com/a', content: 'one' },
      { title: 'A dup', url: 'https://example.com/a', content: 'duplicate' },
      { title: 'bad', url: 'javascript:alert(1)', content: 'no' },
    ]);
    expect(results).toHaveLength(1); expect(results[0]?.url).toBe('https://example.com/a'); expect(results[0]?.rank).toBe(1);
  });

  it('does not allow Search Editor citations outside SearchContext', async () => {
    const provider = { name: 'test', supports: () => true, generateText: async () => ({ text: JSON.stringify({ answer: 'x', sources: ['https://evil.example'] }), provider: 'test', model: 'm' }) };
    await expect(runSearchEditor([provider], { key: 's', provider: 'test', providerModelId: 'm', capabilities: ['search-editor'] }, 'q', [{ title: 'ok', url: 'https://example.com/a', snippet: 'x', publishedDate: null, source: 'example.com', rank: 1 }])).rejects.toThrow();
  });

  it('passes only query and normalized search context to the editor', async () => {
    let prompt = ''; let system = '';
    const provider = { name: 'test', supports: () => true, generateText: async (input: { model: string; prompt: string; systemPrompt?: string }) => { prompt = input.prompt; system = input.systemPrompt ?? ''; return { text: JSON.stringify({ answer: 'grounded', sources: ['https://example.com/a'] }), provider: 'test', model: input.model }; } };
    const result = await runSearchEditor([provider], { key: 's', provider: 'test', providerModelId: 'm', capabilities: ['search-editor'] }, 'current query', [{ title: 'ok', url: 'https://example.com/a', snippet: 'evidence', publishedDate: null, source: 'example.com', rank: 1 }]);
    expect(result.answer).toBe('grounded'); expect(prompt).toContain('current query'); expect(prompt).toContain('SearchContext'); expect(system).toContain('not a web agent'); expect(prompt).not.toContain('conversation history');
  });
});

import { noSearchResultAnswer } from '../../src/features/search/editor';

describe('search safety regressions', () => {
  it('returns controlled empty-result response without editor content', () => {
    expect(noSearchResultAnswer()).toEqual({
      answer: 'Не удалось найти достаточно релевантных источников для ответа.',
      sources: [],
    });
  });
});
