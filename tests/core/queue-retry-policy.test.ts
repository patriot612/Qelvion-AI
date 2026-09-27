import { describe, expect, it, vi } from 'vitest';
import { consumeHeavyTasks } from '../../src/queue/consumer/worker';
import { DomainError } from '../../src/core/errors/domain';

const body = { taskId: 't', operationId: 'o', userId: 'u', type: 'image', model: 'm', prompt: 'p', templateKey: null, metadata: {} } as any;
function message(body: any, attempts = 1) { return { body, attempts, ack: vi.fn(), retry: vi.fn() } as any; }

describe('queue retry policy', () => {
  it('acks permanent domain errors instead of retrying forever', async () => {
    const m = message(body);
    await consumeHeavyTasks({ messages: [m] } as any, { process: vi.fn().mockRejectedValue(new DomainError('INVALID_INPUT', 'bad payload')) });
    expect(m.ack).toHaveBeenCalledOnce();
    expect(m.retry).not.toHaveBeenCalled();
  });

  it('stops retrying after the configured retry count is exhausted', async () => {
    const m = message(body, 6);
    await consumeHeavyTasks({ messages: [m] } as any, { process: vi.fn().mockRejectedValue(new DomainError('PROVIDER_ERROR', 'temporary', true)) });
    expect(m.ack).toHaveBeenCalledOnce();
    expect(m.retry).not.toHaveBeenCalled();
  });

  it('retries explicitly retryable errors', async () => {
    const m = message(body);
    await consumeHeavyTasks({ messages: [m] } as any, { process: vi.fn().mockRejectedValue(new DomainError('PROVIDER_ERROR', 'temporary', true)) });
    expect(m.retry).toHaveBeenCalledOnce();
    expect(m.ack).not.toHaveBeenCalled();
  });
  it('acks a retryable error on the configured final attempt', async () => {
    const m = message(body, 5);
    await consumeHeavyTasks({ messages: [m] } as any, { process: vi.fn().mockRejectedValue(new DomainError('PROVIDER_ERROR', 'temporary', true)) }, undefined, 5);
    expect(m.ack).toHaveBeenCalledOnce();
    expect(m.retry).not.toHaveBeenCalled();
  });

});
