import type { OperationStatus } from './types';
import { DomainError } from '../errors/domain';

const allowed: Record<OperationStatus, readonly OperationStatus[]> = {
  created: ['reserved', 'cancelled'],
  reserved: ['running', 'failed', 'cancelled'],
  running: ['succeeded', 'failed', 'delivery_pending'],
  succeeded: ['delivery_pending', 'delivered'],
  failed: [],
  cancelled: [],
  delivery_pending: ['delivered', 'failed'],
  delivered: [],
};

export function assertOperationTransition(from: OperationStatus, to: OperationStatus): void {
  if (!allowed[from].includes(to)) {
    throw new DomainError('CONFLICT', `Invalid operation transition: ${from} -> ${to}`);
  }
}
