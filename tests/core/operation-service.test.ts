import { describe, expect, it, vi } from 'vitest';
import { createReservedOperation, settleOperation } from '../../src/core/operations/service';
import type { OperationRepository } from '../../src/db/repositories/operations';
import type { PointRepository } from '../../src/db/repositories/points';
import type { OperationRecord } from '../../src/core/operations/types';

describe('operation service', () => {
  it('reserves points once before execution', async () => {
    const base: OperationRecord = {
      operationId: 'op-1', requestId: 'req-1', userId: 'u-1', type: 'image', status: 'created',
      provider: null, model: 'image-1', cost: 15, reservedPoints: 0, attempt: 0,
      createdAt: new Date().toISOString(), startedAt: null, finishedAt: null, errorCode: null, metadataJson: '{}',
    };
    const repository: OperationRepository = {
      create: vi.fn(async () => undefined),
      find: vi.fn(async () => ({ ...base, status: 'reserved' as const })),
      transition: vi.fn(async () => undefined),
    };
    const points: PointRepository = { reserve: vi.fn(async () => undefined), capture: vi.fn(async () => undefined), release: vi.fn(async () => undefined) };
    await createReservedOperation(repository, points, base);
    expect(points.reserve).toHaveBeenCalledWith('u-1', 'op-1', 15);
  });

  it('captures on success and releases on failure', async () => {
    const operation: OperationRecord = {
      operationId: 'op-1', requestId: 'req-1', userId: 'u-1', type: 'search', status: 'reserved',
      provider: null, model: 'm', cost: 3, reservedPoints: 3, attempt: 0,
      createdAt: new Date().toISOString(), startedAt: null, finishedAt: null, errorCode: null, metadataJson: '{}',
    };
    const repository: OperationRepository = {
      create: vi.fn(async () => undefined),
      find: vi.fn(async () => operation),
      transition: vi.fn(async () => undefined),
    };
    const points: PointRepository = { reserve: vi.fn(async () => undefined), capture: vi.fn(async () => undefined), release: vi.fn(async () => undefined) };
    await settleOperation(repository, points, 'op-1', 'success');
    expect(points.capture).toHaveBeenCalledWith('u-1', 'op-1', 3);
  });
  it('does not settle an already terminal operation twice', async () => {
    const operation: OperationRecord = {
      operationId: 'op-terminal', requestId: 'req-terminal', userId: 'u-1', type: 'search', status: 'succeeded',
      provider: null, model: 'm', cost: 3, reservedPoints: 3, attempt: 1,
      createdAt: new Date().toISOString(), startedAt: null, finishedAt: new Date().toISOString(), errorCode: null, metadataJson: '{}',
    };
    const repository: OperationRepository = {
      create: vi.fn(async () => undefined),
      find: vi.fn(async () => operation),
      transition: vi.fn(async () => undefined),
    };
    const points: PointRepository = { reserve: vi.fn(async () => undefined), capture: vi.fn(async () => undefined), release: vi.fn(async () => undefined) };

    await settleOperation(repository, points, 'op-terminal', 'success');

    expect(points.capture).not.toHaveBeenCalled();
    expect(points.release).not.toHaveBeenCalled();
    expect(repository.transition).not.toHaveBeenCalled();
  });

});
