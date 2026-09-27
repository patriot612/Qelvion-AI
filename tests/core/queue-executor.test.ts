import { describe, expect, it, vi } from 'vitest';
import { createOperationExecutor } from '../../src/queue/consumer/executor';
import type { HeavyTaskMessage } from '../../src/queue/tasks/types';

const task: HeavyTaskMessage = {
  taskId: 'task-1', operationId: 'op-1', userId: 'u-1', type: 'image', model: 'image-1', prompt: 'draw', templateKey: null, metadata: {},
};

describe('queue executor boundary', () => {
  it('delegates task processing without owning billing logic', async () => {
    const process = vi.fn(async () => undefined);
    const executor = createOperationExecutor({ process });
    await executor.execute(task);
    expect(process).toHaveBeenCalledWith(task);
  });
});
