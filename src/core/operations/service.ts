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
  try {
    if (input.cost > 0) await pointRepository.reserve(input.userId, input.operationId, input.cost);
    await operationRepository.transition(input.operationId, 'created', 'reserved');
  } catch (error) {
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
  const operation = await operationRepository.find(operationId);
  if (!operation) throw new Error(`Operation ${operationId} not found`);
  if (operation.status === 'reserved') {
    await operationRepository.transition(operationId, 'reserved', 'running', { attempt: operation.attempt + 1, startedAt: new Date().toISOString() });
  }
  if (result === 'success') {
    if (operation.cost > 0) await pointRepository.capture(operation.userId, operation.operationId, operation.cost);
    await operationRepository.transition(operationId, 'running', 'succeeded', { finishedAt: new Date().toISOString() });
    return;
  }
  if (operation.cost > 0) await pointRepository.release(operation.userId, operation.operationId, operation.cost);
  await operationRepository.transition(operationId, 'running', 'failed', { finishedAt: new Date().toISOString() });
}
