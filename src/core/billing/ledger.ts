import { DomainError } from '../errors/domain';

export type LedgerEntryKind = 'reserve' | 'capture' | 'release' | 'grant' | 'purchase' | 'refund';

export interface LedgerEntry {
  entryId: string;
  operationId: string | null;
  userId: string;
  kind: LedgerEntryKind;
  amount: number;
  createdAt: string;
  metadataJson: string;
}

export function assertNonNegativeBalance(balance: number): void {
  if (!Number.isFinite(balance) || balance < 0) {
    throw new DomainError('BILLING_ERROR', 'Point balance cannot be negative');
  }
}

export function calculateOperationSettlement(cost: number, captured: boolean): { capture: number; release: number } {
  if (!Number.isFinite(cost) || cost < 0) {
    throw new DomainError('INVALID_INPUT', 'Operation cost must be a non-negative finite number');
  }
  return captured ? { capture: cost, release: 0 } : { capture: 0, release: cost };
}
