export type OperationType =
  | 'chat'
  | 'search'
  | 'image'
  | 'document'
  | 'audio'
  | 'voice'
  | 'payment';

export type OperationStatus =
  | 'created'
  | 'reserved'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'delivery_pending'
  | 'delivered';

export interface OperationRecord {
  operationId: string;
  requestId: string;
  userId: string;
  type: OperationType;
  status: OperationStatus;
  provider: string | null;
  model: string | null;
  cost: number;
  reservedPoints: number;
  attempt: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorCode: string | null;
  metadataJson: string;
}
