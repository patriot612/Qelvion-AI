import type { HeavyTaskMessage } from '../tasks/types';

export interface OperationExecutor {
  execute(message: HeavyTaskMessage): Promise<void>;
}

export async function handleHeavyTaskBatch(
  messages: readonly HeavyTaskMessage[],
  executor: OperationExecutor,
): Promise<void> {
  for (const message of messages) {
    await executor.execute(message);
  }
}
