import { createReservedOperation, settleOperation } from '../../core/operations/service';
import type { OperationRepository } from '../../db/repositories/operations';
import type { PointRepository } from '../../db/repositories/points';
import { D1ConfigRepository } from '../../db/repositories/config';
import type { AiProvider } from '../../ai/gateway/types';
import type { AiModelDescriptor } from '../../ai/gateway/gateway';
import { SearxngClient } from './client';
import { noSearchResultAnswer, runSearchEditor } from './editor';

export interface SearchExecutionDeps { db: D1Database; providers: readonly AiProvider[]; operationRepository: OperationRepository; pointRepository: PointRepository; model: AiModelDescriptor; userId: string; requestId: string; searxngBaseUrl: string; searxngUsername?: string; searxngPassword?: string; }
export async function executeSearch(deps: SearchExecutionDeps, query: string): Promise<{ answer: string; sources: string[]; operationId: string }> {
  const config = new D1ConfigRepository(deps.db); const price = await config.getJson<number>('search.price', 3); const limit = await config.getJson<number>('search.results_limit', 5); const configuredTimeout = await config.getJson<number>('search.timeout_ms', 30000); const timeout = Math.min(Math.max(configuredTimeout, 5000), 45000);
  const baseUrl = deps.searxngBaseUrl;
  const operationId = crypto.randomUUID(); const now = new Date().toISOString();
  await createReservedOperation(deps.operationRepository, deps.pointRepository, { operationId, requestId: deps.requestId, userId: deps.userId, type: 'search', provider: deps.model.provider, model: deps.model.providerModelId, cost: price, attempt: 0, createdAt: now, startedAt: null, finishedAt: null, errorCode: null, metadataJson: JSON.stringify({ query }) });
  try {
    const client = new SearxngClient(baseUrl, timeout, deps.searxngUsername, deps.searxngPassword); const results = await client.search(query, { limit });
    if (results.length === 0) { await settleOperation(deps.operationRepository, deps.pointRepository, operationId, 'success'); return { ...noSearchResultAnswer(), operationId }; }
    const answer = await runSearchEditor(deps.providers, deps.model, query, results); await settleOperation(deps.operationRepository, deps.pointRepository, operationId, 'success'); return { ...answer, operationId };
  } catch (error) { await settleOperation(deps.operationRepository, deps.pointRepository, operationId, 'failure'); throw error; }
}
