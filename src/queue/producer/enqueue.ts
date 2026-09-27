import type { HeavyTaskMessage } from '../tasks/types';

export interface HeavyTaskQueue {
  send(message: HeavyTaskMessage): Promise<unknown>;
}

export async function enqueueHeavyTask(queue: HeavyTaskQueue, message: HeavyTaskMessage): Promise<void> {
  await queue.send(message);
}
