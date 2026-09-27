import type { HeavyTaskProcessor } from './executor';
import type { HeavyTaskMessage } from '../tasks/types';
import { DomainError } from '../../core/errors/domain';

export interface HeavyTaskFailureSink { report(task: HeavyTaskMessage, error: unknown): Promise<void>; }

export function isRetryableQueueError(error: unknown): boolean {
  return error instanceof DomainError ? error.retryable : true;
}

export async function consumeHeavyTasks(
  batch: MessageBatch<HeavyTaskMessage>,
  processor: HeavyTaskProcessor,
  failureSink?: HeavyTaskFailureSink,
): Promise<void> {
  for (const message of batch.messages) {
    try {
      await processor.process(message.body);
      message.ack();
    } catch (error) {
      if (failureSink) await failureSink.report(message.body, error);
      if (isRetryableQueueError(error)) message.retry();
      else message.ack();
    }
  }
}
