import { describe, expect, it } from 'vitest';
import { normalizeSearchResults } from '../../src/features/search/client';

describe('search runtime configuration boundary', () => {
  it('does not treat a non-http URL as a valid search source', () => {
    expect(normalizeSearchResults([
      { title: 'bad', url: 'file:///etc/passwd', content: 'no' },
      { title: 'ok', url: 'https://example.com', content: 'yes' },
    ])).toEqual([
      expect.objectContaining({ url: 'https://example.com' }),
    ]);
  });
});
