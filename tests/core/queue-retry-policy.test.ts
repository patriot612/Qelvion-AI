import { describe, expect, it, vi } from 'vitest';
import { consumeHeavyTasks } from '../../src/queue/consumer/worker';
import { DomainError } from '../../src/core/errors/domain';

const body = { taskId: 't', operationId: 'o', userId: 'u', type: 'image', model: 'm', prompt: 'p', templateKey: null, metadata: {} } as any;
function message(body: any) { return { body, ack: vi.fn(), retry: vi.fn() } as any; }

describe('queue retry policy', () => {
  it('acks permanent domain errors instead of retrying forever', async () => {
    const m = message(body);
    await consumeHeavyTasks({ messages: [m] } as any, { process: vi.fn().mockRejectedValue(new DomainError('INVALID_INPUT', 'bad payload')) });
    expect(m.ack).toHaveBeenCalledOnce();
    expect(m.retry).not.toHaveBeenCalled();
  });

  it('retries explicitly retryable errors', async () => {
    const m = message(body);
    await consumeHeavyTasks({ messages: [m] } as any, { process: vi.fn().mockRejectedValue(new DomainError('PROVIDER_ERROR', 'temporary', true)) });
    expect(m.retry).toHaveBeenCalledOnce();
    expect(m.ack).not.toHaveBeenCalled();
  });
});
