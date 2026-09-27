import { describe, expect, it, vi } from 'vitest';
import { enqueueHeavyTask } from '../../src/queue/producer/enqueue';
import { handleHeavyTaskBatch } from '../../src/queue/consumer/handler';
import type { HeavyTaskMessage } from '../../src/queue/tasks/types';

const task: HeavyTaskMessage = {
  taskId: 'task-1', operationId: 'op-1', userId: 'u-1', type: 'image', model: 'model-1',
  prompt: 'draw', templateKey: null, metadata: { aspectRatio: '1:1' },
};

describe('heavy task queue', () => {
  it('publishes exactly the task metadata', async () => {
    const send = vi.fn(async () => undefined);
    await enqueueHeavyTask({ send }, task);
    expect(send).toHaveBeenCalledWith(task);
  });

  it('executes each queued task once per delivered message', async () => {
    const execute = vi.fn(async () => undefined);
    await handleHeavyTaskBatch([task], { execute });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(task);
  });
});
