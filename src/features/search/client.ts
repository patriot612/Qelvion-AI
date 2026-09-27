import { DomainError } from '../../core/errors/domain';
import type { SearchResult } from './types';

export interface SearxResponse { results?: Array<{ title?: string; url?: string; content?: string; publishedDate?: string; published_date?: string; engine?: string; category?: string }>; }
export class SearxngClient {
  constructor(private readonly baseUrl: string, private readonly timeoutMs = 30000, private readonly username?: string, private readonly password?: string, private readonly maxRetries = 1) {}
  async search(query: string, options: { language?: string; safeSearch?: number; timeRange?: string; limit: number }): Promise<SearchResult[]> {
    if (!query.trim()) throw new DomainError('INVALID_INPUT', 'Search query is empty');
    let base: URL;
    try { base = new URL(this.baseUrl); } catch { throw new DomainError('INVALID_INPUT', 'SearXNG base URL is invalid'); }
    if (base.protocol !== 'http:' && base.protocol !== 'https:') throw new DomainError('INVALID_INPUT', 'SearXNG base URL must use HTTP(S)');
    const url = new URL('/search', base);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('language', options.language ?? 'all');
    url.searchParams.set('safesearch', String(options.safeSearch ?? 1));
    if (options.timeRange) url.searchParams.set('time_range', options.timeRange);

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.username && this.password) headers.Authorization = `Basic ${btoa(`${this.username}:${this.password}`)}`;

    let lastError: unknown = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(url, { headers, signal: controller.signal });
        if (!response.ok) {
          const retryable = response.status >= 500 || response.status === 429;
          if (retryable && attempt < this.maxRetries) continue;
          throw new DomainError('PROVIDER_ERROR', `SearXNG request failed with ${response.status}`, retryable);
        }
        const body = await response.json() as SearxResponse;
        if (!Array.isArray(body.results)) throw new DomainError('PROVIDER_ERROR', 'SearXNG returned malformed JSON');
        return normalizeSearchResults(body.results).slice(0, options.limit);
      } catch (error) {
        lastError = error;
        if (error instanceof DomainError) {
          if (error.retryable && attempt < this.maxRetries) continue;
          throw error;
        }
        if (attempt < this.maxRetries) continue;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof DomainError ? lastError : new DomainError('PROVIDER_ERROR', 'SearXNG unavailable', true);
  }
}
export function normalizeSearchResults(results: SearxResponse['results']): SearchResult[] {
  const seen = new Set<string>(); const normalized: SearchResult[] = [];
  for (const [index, item] of (results ?? []).entries()) { if (!item.url || !isHttpUrl(item.url) || seen.has(item.url)) continue; seen.add(item.url); let source: string; try { source = new URL(item.url).hostname; } catch { continue; } normalized.push({ title: (item.title ?? source).slice(0, 300), url: item.url, snippet: (item.content ?? '').slice(0, 1200), publishedDate: item.publishedDate ?? item.published_date ?? null, source, rank: index + 1 }); }
  return normalized;
}
function isHttpUrl(value: string): boolean { try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:'; } catch { return false; } }
