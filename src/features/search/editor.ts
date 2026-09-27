import { generateTextWithGateway, type AiModelDescriptor } from '../../ai/gateway/gateway';
import type { AiProvider } from '../../ai/gateway/types';
import type { SearchAnswer, SearchResult } from './types';

const SEARCH_INSTRUCTIONS = `You are the Search Editor for Qelvion-AI. You are not a web agent. Use only the supplied search results. Do not use outside knowledge, tools, web search, or conversation history. Every material factual claim must be supported by one or more supplied source URLs. If sources conflict, explicitly say so. If evidence is insufficient, say so. Return strict JSON: {"answer":"...","sources":["https://..."]}. Sources must be copied exactly from supplied results.`;

export async function runSearchEditor(providers: readonly AiProvider[], model: AiModelDescriptor, query: string, results: readonly SearchResult[], timeoutMs?: number): Promise<SearchAnswer> {
  const context = results.map((item, index) => `[${index + 1}] ${item.title}\nURL: ${item.url}\nSource: ${item.source}\nDate: ${item.publishedDate ?? 'unknown'}\nSnippet: ${item.snippet}`).join('\n\n');
  const input = timeoutMs === undefined
    ? { prompt: `User query:\n${query}\n\nSearchContext:\n${context}`, systemPrompt: SEARCH_INSTRUCTIONS }
    : { prompt: `User query:\n${query}\n\nSearchContext:\n${context}`, systemPrompt: SEARCH_INSTRUCTIONS, timeoutMs };
  const response = await generateTextWithGateway(providers, model, input, 'search-editor');
  const answer = parseSearchAnswer(response.text);
  const allowed = new Set(results.map((item) => item.url));
  for (const source of answer.sources) if (!allowed.has(source)) throw new Error('Search Editor returned a source URL that was not present in SearchContext');
  return answer;
}
function parseSearchAnswer(text: string): SearchAnswer {
  try { const parsed = JSON.parse(text) as { answer?: string; sources?: unknown }; if (typeof parsed.answer !== 'string' || !Array.isArray(parsed.sources) || !parsed.sources.every((s) => typeof s === 'string')) throw new Error(); return { answer: parsed.answer.trim(), sources: parsed.sources }; } catch { throw new Error('Malformed Search Editor response'); }
}
export function noSearchResultAnswer(): SearchAnswer { return { answer: 'Не удалось найти достаточно релевантных источников для ответа.', sources: [] }; }
