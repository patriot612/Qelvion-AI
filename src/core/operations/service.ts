import type { OperationRepository } from '../../db/repositories/operations';
import type { PointRepository } from '../../db/repositories/points';
import type { OperationRecord, OperationStatus, OperationType } from './types';

export async function createReservedOperation(
  operationRepository: OperationRepository,
  pointRepository: PointRepository,
  input: Omit<OperationRecord, 'status' | 'reservedPoints'> & { cost: number },
): Promise<OperationRecord> {
  const operation: OperationRecord = { ...input, status: 'created', reservedPoints: input.cost };
  await operationRepository.create(operation);
  let pointsReserved = false;
  try {
    if (input.cost > 0) {
      await pointRepository.reserve(input.userId, input.operationId, input.cost);
      pointsReserved = true;
    }
    await operationRepository.transition(input.operationId, 'created', 'reserved');
  } catch (error) {
    if (pointsReserved) {
      try { await pointRepository.release(input.userId, input.operationId, input.cost); } catch { /* preserve original failure */ }
    }
    try { await operationRepository.transition(input.operationId, 'created', 'cancelled', { finishedAt: new Date().toISOString(), errorCode: 'RESERVATION_FAILED' }); } catch { /* preserve original failure */ }
    throw error;
  }
  return { ...operation, status: 'reserved' };
}

export async function settleOperation(
  operationRepository: OperationRepository,
  pointRepository: PointRepository,
  operationId: string,
  result: 'success' | 'failure',
): Promise<void> {
  let operation = await operationRepository.find(operationId);
  if (!operation) throw new Error(`Operation ${operationId} not found`);
  if (operation.status === 'succeeded' || operation.status === 'failed' || operation.status === 'cancelled' || operation.status === 'delivered') {
    return;
  }
  if (operation.status === 'delivery_pending') {
    if (result === 'success') return;
    if (operation.cost > 0) await pointRepository.release(operation.userId, operation.operationId, operation.cost);
    await operationRepository.transition(operationId, 'delivery_pending', 'failed', { finishedAt: new Date().toISOString(), errorCode: 'DELIVERY_FAILED' });
    return;
  }
  if (operation.status === 'reserved') {
    try {
      await operationRepository.transition(operationId, 'reserved', 'running', { attempt: operation.attempt + 1, startedAt: new Date().toISOString() });
      operation = { ...operation, status: 'running' };
    } catch (error) {
      const latest = await operationRepository.find(operationId);
      if (latest && (latest.status === 'succeeded' || latest.status === 'failed' || latest.status === 'cancelled' || latest.status === 'delivered' || latest.status === 'delivery_pending')) return;
      throw error;
    }
  }
  if (operation.status !== 'running') throw new Error('Operation is not settleable');
  if (result === 'success') {
    if (operation.cost > 0) await pointRepository.capture(operation.userId, operation.operationId, operation.cost);
    await operationRepository.transition(operationId, 'running', 'succeeded', { finishedAt: new Date().toISOString() });
    return;
  }
  if (operation.cost > 0) await pointRepository.release(operation.userId, operation.operationId, operation.cost);
  await operationRepository.transition(operationId, 'running', 'failed', { finishedAt: new Date().toISOString() });
}
