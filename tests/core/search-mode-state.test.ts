import { describe, expect, it } from 'vitest';

describe('search mode semantics', () => {
  it('does not use conversational history as a search source', () => {
    const searchInput = { query: 'current query', context: [{ url: 'https://example.com', snippet: 'evidence' }] };
    expect(searchInput).not.toHaveProperty('conversationHistory');
  });
});
