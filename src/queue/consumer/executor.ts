import type { HeavyTaskMessage } from '../tasks/types';
import type { OperationExecutor } from './handler';

export interface HeavyTaskProcessor { process(task: HeavyTaskMessage): Promise<void>; }

export function createOperationExecutor(processor: HeavyTaskProcessor): OperationExecutor {
  return { async execute(message) { await processor.process(message); } };
}
