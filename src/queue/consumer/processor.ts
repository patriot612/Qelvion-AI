import type { Env } from '../../env';
import type { HeavyTaskMessage, HeavyTaskType } from '../tasks/types';
import { executeMediaTask } from './media';
import { D1OperationRepository } from '../../db/repositories/operations';
import { D1PointRepository } from '../../db/repositories/points';
import { D1ModelRegistry } from '../../ai/registry';
import { createOpenAIProvider } from '../../ai/providers/openai';
import { createAnthropicProvider } from '../../ai/providers/anthropic';
import { createGoogleProvider } from '../../ai/providers/google';
import { createOpenRouterProvider } from '../../ai/providers/openrouter';
import type { AiProvider } from '../../ai/gateway/types';
import { settleOperation } from '../../core/operations/service';
import { assertOperationTransition } from '../../core/operations/state';
import type { OperationType } from '../../core/operations/types';
import { DomainError } from '../../core/errors/domain';

export class D1HeavyTaskProcessor {
  private readonly operations: D1OperationRepository;
  private readonly points: D1PointRepository;
  private readonly models: D1ModelRegistry;
  private readonly providers: readonly AiProvider[];
  constructor(private readonly env: Env) {
    this.operations = new D1OperationRepository(env.QELVION_DB);
    this.points = new D1PointRepository(env.QELVION_DB);
    this.models = new D1ModelRegistry(env.QELVION_DB);
    this.providers = [
      createOpenAIProvider(env.OPENAI_API_KEY),
      createAnthropicProvider(env.ANTHROPIC_API_KEY),
      createGoogleProvider(env.GOOGLE_AI_API_KEY),
      createOpenRouterProvider(env.OPENROUTER_API_KEY),
    ].filter((provider): provider is AiProvider => Boolean(provider));
  }

  async process(task: HeavyTaskMessage, deliveryAttempt = 1, maxRetries = 5): Promise<void> {
    let operation = await this.operations.find(task.operationId);
    if (!operation) throw new DomainError('NOT_FOUND', 'Operation not found');
    if (operation.status === 'delivered' || operation.status === 'cancelled' || operation.status === 'failed') return;

    if (operation.status === 'reserved') {
      assertOperationTransition('reserved', 'running');
      await this.operations.transition(operation.operationId, 'reserved', 'running', { attempt: operation.attempt + 1, startedAt: new Date().toISOString() });
      operation = (await this.operations.find(task.operationId))!;
    }

    if (operation.status === 'running') {
      try {
        const existingMetadata = JSON.parse(operation.metadataJson || '{}') as { result?: string };
        const result = existingMetadata.result ?? await this.executeTask(task, operation.provider, operation.model);
        if (existingMetadata.result === undefined) {
          await this.env.QELVION_DB.prepare('UPDATE operations SET metadata_json = ? WHERE operation_id = ?')
            .bind(JSON.stringify({ ...existingMetadata, result }), operation.operationId).run();
        }
        await this.operations.transition(operation.operationId, 'running', 'delivery_pending');
        operation = (await this.operations.find(task.operationId))!;
      } catch (error) {
        const retryable = error instanceof DomainError ? error.retryable : true;
        if (!retryable || deliveryAttempt > maxRetries) {
          await settleOperation(this.operations, this.points, operation.operationId, 'failure');
        }
        throw error;
      }
    }

    if (operation.status !== 'delivery_pending') return;
    const metadata = JSON.parse(operation.metadataJson || '{}') as { result?: string; deliveryMessageId?: number };
    if (!metadata.result) throw new DomainError('INVALID_INPUT', 'Media result missing for delivery');

    try {
      if (typeof metadata.deliveryMessageId !== 'number') {
        const { deliverMediaResult } = await import('./delivery');
        const deliveryMessageId = await deliverMediaResult(this.env, task, metadata.result);
        if (deliveryMessageId !== null) {
          await this.env.QELVION_DB.prepare('UPDATE operations SET metadata_json = ? WHERE operation_id = ?')
            .bind(JSON.stringify({ ...metadata, deliveryMessageId }), operation.operationId).run();
        }
      }
    } catch (error) {
      const retryable = error instanceof DomainError ? error.retryable : true;
      if (!retryable || deliveryAttempt >= maxRetries) {
        await settleOperation(this.operations, this.points, operation.operationId, 'failure');
      }
      throw error;
    }

    await this.points.capture(operation.userId, operation.operationId, operation.cost);
    await this.operations.transition(operation.operationId, 'delivery_pending', 'delivered', { finishedAt: new Date().toISOString() });
  }

  async executeTask(task: HeavyTaskMessage, provider: string | null, providerModelId: string | null): Promise<string> {
    if (!provider || !providerModelId) throw new DomainError('INVALID_INPUT', 'Media operation has no provider/model');
    const model = await this.models.getActiveByProviderModelId(provider, providerModelId);
    if (!model) throw new DomainError('INVALID_INPUT', `Configured media model is unavailable: ${provider}:${providerModelId}`);
    return executeMediaTask(this.providers, model, task);
  }
}

export function operationTypeForTask(task: HeavyTaskType): OperationType { return task; }
