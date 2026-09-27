import type { OperationRecord, OperationStatus, OperationType } from '../../core/operations/types';
import { assertOperationTransition } from '../../core/operations/state';
import { DomainError } from '../../core/errors/domain';

export interface OperationRepository {
  create(operation: OperationRecord): Promise<void>;
  find(operationId: string): Promise<OperationRecord | null>;
  transition(operationId: string, from: OperationStatus, to: OperationStatus, patch?: Partial<Pick<OperationRecord, 'provider' | 'model' | 'attempt' | 'startedAt' | 'finishedAt' | 'errorCode'>>): Promise<void>;
}

interface OperationDbRow {
  operation_id: string;
  request_id: string;
  user_id: string;
  type: OperationType;
  status: OperationStatus;
  provider: string | null;
  model: string | null;
  cost: number;
  reserved_points: number;
  attempt: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error_code: string | null;
  metadata_json: string;
}

export class D1OperationRepository implements OperationRepository {
  constructor(private readonly db: D1Database) {}

  async create(operation: OperationRecord): Promise<void> {
    const result = await this.db.prepare(`
      INSERT INTO operations (
        operation_id, request_id, user_id, type, status, provider, model, cost,
        reserved_points, attempt, created_at, started_at, finished_at, error_code, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      operation.operationId,
      operation.requestId,
      operation.userId,
      operation.type,
      operation.status,
      operation.provider,
      operation.model,
      operation.cost,
      operation.reservedPoints,
      operation.attempt,
      operation.createdAt,
      operation.startedAt,
      operation.finishedAt,
      operation.errorCode,
      operation.metadataJson,
    ).run();
    if (!result.success) throw new DomainError('DATABASE_ERROR', 'Failed to create operation');
  }

  async find(operationId: string): Promise<OperationRecord | null> {
    const row = await this.db.prepare('SELECT * FROM operations WHERE operation_id = ?').bind(operationId).first<OperationDbRow>();
    if (!row) return null;
    return mapOperation(row);
  }

  async transition(
    operationId: string,
    from: OperationStatus,
    to: OperationStatus,
    patch: Partial<Pick<OperationRecord, 'provider' | 'model' | 'attempt' | 'startedAt' | 'finishedAt' | 'errorCode'>> = {},
  ): Promise<void> {
    assertOperationTransition(from, to);
    const current = await this.find(operationId);
    if (!current) throw new DomainError('NOT_FOUND', `Operation ${operationId} not found`);
    if (current.status !== from) throw new DomainError('CONFLICT', `Operation ${operationId} is already ${current.status}`);

    await this.db.prepare(`
      UPDATE operations
      SET status = ?, provider = ?, model = ?, attempt = ?, started_at = ?, finished_at = ?, error_code = ?
      WHERE operation_id = ? AND status = ?
    `).bind(
      to,
      patch.provider ?? current.provider,
      patch.model ?? current.model,
      patch.attempt ?? current.attempt,
      patch.startedAt ?? current.startedAt,
      patch.finishedAt ?? current.finishedAt,
      patch.errorCode ?? current.errorCode,
      operationId,
      from,
    ).run();
  }
  async listRecent(limit = 10): Promise<OperationRecord[]> {
    const result = await this.db.prepare('SELECT * FROM operations ORDER BY created_at DESC LIMIT ?').bind(limit).all<OperationDbRow>();
    return result.results.map(mapOperation);
  }

}

function mapOperation(row: OperationDbRow): OperationRecord {
  return {
    operationId: row.operation_id,
    requestId: row.request_id,
    userId: row.user_id,
    type: row.type,
    status: row.status,
    provider: row.provider,
    model: row.model,
    cost: row.cost,
    reservedPoints: row.reserved_points,
    attempt: row.attempt,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    errorCode: row.error_code,
    metadataJson: row.metadata_json,
  };
}
