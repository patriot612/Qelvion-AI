import type { UserRow } from '../schema/types';
import type { OperationRecord, OperationStatus, OperationType } from '../../core/operations/types';
import type { AiModelDescriptor } from '../../ai/gateway/gateway';
import type { RoleRecord } from './roles';

export interface AdminAuditEntry { auditId: string; adminTelegramId: number; targetUserId: string | null; action: string; beforeJson: string; afterJson: string; createdAt: string; }

export class D1AdminRepository {
  constructor(private readonly db: D1Database) {}

  async listUsers(limit = 25, offset = 0, query?: string): Promise<UserRow[]> {
    const pattern = query ? `%${query}%` : null;
    const result = pattern
      ? await this.db.prepare('SELECT * FROM users WHERE CAST(telegram_user_id AS TEXT) LIKE ? OR id LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(pattern, pattern, limit, offset).all<UserRow>()
      : await this.db.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(limit, offset).all<UserRow>();
    return result.results;
  }

  async countUsers(): Promise<number> {
    const row = await this.db.prepare('SELECT COUNT(*) AS count FROM users').first<{ count: number }>();
    return row?.count ?? 0;
  }

  async listRoles(limit = 100, offset = 0): Promise<RoleRecord[]> {
    const result = await this.db.prepare('SELECT * FROM roles ORDER BY key LIMIT ? OFFSET ?').bind(limit, offset).all<{ key: string; name: string; prompt: string; point_cost: number; active: number; config_json: string }>();
    return result.results.map((row) => ({ key: row.key, name: row.name, prompt: row.prompt, pointCost: row.point_cost, active: row.active === 1, config: JSON.parse(row.config_json) as Record<string, unknown> }));
  }

  async upsertRole(role: { key: string; name: string; prompt: string; pointCost: number; active: boolean; config?: Record<string, unknown> }): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare(`INSERT INTO roles (key,name,prompt,point_cost,active,config_json,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET name=excluded.name,prompt=excluded.prompt,point_cost=excluded.point_cost,active=excluded.active,config_json=excluded.config_json,updated_at=excluded.updated_at`)
      .bind(role.key, role.name, role.prompt, role.pointCost, role.active ? 1 : 0, JSON.stringify(role.config ?? {}), now).run();
  }

  async listTariffs(limit = 100, offset = 0): Promise<Array<Record<string, unknown>>> {
    const result = await this.db.prepare('SELECT * FROM tariffs ORDER BY key LIMIT ? OFFSET ?').bind(limit, offset).all<Record<string, unknown>>();
    return result.results;
  }

  async upsertTariff(input: { key: string; name: string; status: string; dailyPoints: number; activeDialogLimit: number; archivedDialogLimit: number; archiveTtlHours: number; messageLimitPerDialog: number; config?: Record<string, unknown> }): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare(`INSERT INTO tariffs (key,name,status,daily_points,active_dialog_limit,archived_dialog_limit,archive_ttl_hours,message_limit_per_dialog,config_json,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET name=excluded.name,status=excluded.status,daily_points=excluded.daily_points,active_dialog_limit=excluded.active_dialog_limit,archived_dialog_limit=excluded.archived_dialog_limit,archive_ttl_hours=excluded.archive_ttl_hours,message_limit_per_dialog=excluded.message_limit_per_dialog,config_json=excluded.config_json,updated_at=excluded.updated_at`)
      .bind(input.key,input.name,input.status,input.dailyPoints,input.activeDialogLimit,input.archivedDialogLimit,input.archiveTtlHours,input.messageLimitPerDialog,JSON.stringify(input.config ?? {}),now).run();
  }

  async listPayments(limit = 25, offset = 0, userId?: string): Promise<Array<Record<string, unknown>>> {
    const result = userId
      ? await this.db.prepare('SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(userId, limit, offset).all<Record<string, unknown>>()
      : await this.db.prepare('SELECT * FROM payments ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(limit, offset).all<Record<string, unknown>>();
    return result.results;
  }

  async listOperations(filters: { userId?: string; operationId?: string; type?: OperationType; status?: OperationStatus; provider?: string; model?: string; from?: string; to?: string }, limit = 25, offset = 0): Promise<OperationRecord[]> {
    const where: string[] = [];
    const values: unknown[] = [];
    if (filters.userId) { where.push('user_id = ?'); values.push(filters.userId); }
    if (filters.operationId) { where.push('operation_id = ?'); values.push(filters.operationId); }
    if (filters.type) { where.push('type = ?'); values.push(filters.type); }
    if (filters.status) { where.push('status = ?'); values.push(filters.status); }
    if (filters.provider) { where.push('provider = ?'); values.push(filters.provider); }
    if (filters.model) { where.push('model = ?'); values.push(filters.model); }
    if (filters.from) { where.push('created_at >= ?'); values.push(filters.from); }
    if (filters.to) { where.push('created_at <= ?'); values.push(filters.to); }
    const sql = `SELECT * FROM operations${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    values.push(limit, offset);
    const result = await this.db.prepare(sql).bind(...values).all<DbOperationRow>();
    return result.results.map(mapOperation);
  }

  async listPointLedger(userId: string, limit = 100, offset = 0): Promise<Array<Record<string, unknown>>> {
    const result = await this.db.prepare('SELECT * FROM point_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(userId, limit, offset).all<Record<string, unknown>>();
    return result.results;
  }

  async listDialogs(userId: string, limit = 100, offset = 0): Promise<Array<Record<string, unknown>>> {
    const result = await this.db.prepare('SELECT * FROM dialogs WHERE user_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?').bind(userId, limit, offset).all<Record<string, unknown>>();
    return result.results;
  }

  async addAudit(input: Omit<AdminAuditEntry, 'auditId' | 'createdAt'>): Promise<void> {
    await this.db.prepare('INSERT INTO admin_audit (audit_id,admin_telegram_id,target_user_id,action,before_json,after_json,created_at) VALUES (?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(), input.adminTelegramId, input.targetUserId, input.action, input.beforeJson, input.afterJson, new Date().toISOString()).run();
  }

  async listAudit(limit = 50, offset = 0): Promise<AdminAuditEntry[]> {
    const result = await this.db.prepare('SELECT * FROM admin_audit ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(limit, offset).all<{ audit_id: string; admin_telegram_id: number; target_user_id: string | null; action: string; before_json: string; after_json: string; created_at: string }>();
    return result.results.map((row) => ({ auditId: row.audit_id, adminTelegramId: row.admin_telegram_id, targetUserId: row.target_user_id, action: row.action, beforeJson: row.before_json, afterJson: row.after_json, createdAt: row.created_at }));
  }
}

interface DbOperationRow { operation_id: string; request_id: string; user_id: string; type: OperationType; status: OperationStatus; provider: string | null; model: string | null; cost: number; reserved_points: number; attempt: number; created_at: string; started_at: string | null; finished_at: string | null; error_code: string | null; metadata_json: string; }
function mapOperation(row: DbOperationRow): OperationRecord { return { operationId: row.operation_id, requestId: row.request_id, userId: row.user_id, type: row.type, status: row.status, provider: row.provider, model: row.model, cost: row.cost, reservedPoints: row.reserved_points, attempt: row.attempt, createdAt: row.created_at, startedAt: row.started_at, finishedAt: row.finished_at, errorCode: row.error_code, metadataJson: row.metadata_json }; }
