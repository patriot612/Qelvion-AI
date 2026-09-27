import { DomainError } from '../../core/errors/domain';
import { assertNonNegativeBalance } from '../../core/billing/ledger';

export interface PointRepository {
  reserve(userId: string, operationId: string, amount: number): Promise<void>;
  capture(userId: string, operationId: string, amount: number): Promise<void>;
  release(userId: string, operationId: string, amount: number): Promise<void>;
}

interface ReserveMeta { daily: number; balance: number; }

export class D1PointRepository implements PointRepository {
  constructor(private readonly db: D1Database) {}

  async reserve(userId: string, operationId: string, amount: number): Promise<void> {
    this.validateAmount(amount);
    if (amount === 0) return;
    const existing = await this.db.prepare('SELECT entry_id FROM point_ledger WHERE operation_id = ? AND kind = ?').bind(operationId, 'reserve').first<{ entry_id: string }>();
    if (existing) return;
    const user = await this.db.prepare('SELECT balance_points, daily_points_remaining FROM users WHERE id = ?').bind(userId).first<{ balance_points: number; daily_points_remaining: number }>();
    if (!user) throw new DomainError('NOT_FOUND', `User ${userId} not found`);
    if (user.balance_points + user.daily_points_remaining < amount) throw new DomainError('BILLING_ERROR', 'Insufficient points');
    const daily = Math.min(user.daily_points_remaining, amount);
    const balance = amount - daily;
    const now = new Date().toISOString();
    const reservationToken = operationId;
    try {
      const results = await this.db.batch([
        this.db.prepare(`UPDATE users SET daily_points_remaining = daily_points_remaining - ?, balance_points = balance_points - ?, point_reservation_token = ?, updated_at = ? WHERE id = ? AND balance_points + daily_points_remaining >= ?`).bind(daily, balance, reservationToken, now, userId, amount),
        this.db.prepare(`INSERT INTO point_ledger (entry_id, operation_id, user_id, kind, amount, created_at, metadata_json) SELECT ?, ?, CASE WHEN point_reservation_token = ? THEN id ELSE NULL END, 'reserve', ?, ?, ? FROM users WHERE id = ?`).bind(crypto.randomUUID(), operationId, reservationToken, amount, now, JSON.stringify({ daily, balance } satisfies ReserveMeta), userId),
        this.db.prepare(`UPDATE users SET point_reservation_token = NULL WHERE id = ? AND point_reservation_token = ?`).bind(userId, reservationToken),
      ]);
      if ((results[0]?.meta?.changes ?? 0) !== 1 || (results[1]?.meta?.changes ?? 0) !== 1 || (results[2]?.meta?.changes ?? 0) !== 1) {
        throw new DomainError('CONFLICT', 'Point reservation conflicted with another update');
      }
    } catch (error) {
      if (error instanceof DomainError) throw error;
      if (error instanceof Error && /CONSTRAINT|UNIQUE|NOT NULL/i.test(error.message)) throw new DomainError('CONFLICT', 'Point reservation conflicted with another update');
      throw new DomainError('BILLING_ERROR', 'Failed to reserve points');
    }
  }

  async capture(userId: string, operationId: string, amount: number): Promise<void> {
    this.validateAmount(amount);
    if (amount === 0) return;
    const existing = await this.db.prepare('SELECT entry_id FROM point_ledger WHERE operation_id = ? AND kind = ?').bind(operationId, 'capture').first<{ entry_id: string }>();
    if (existing) return;
    const reserve = await this.db.prepare('SELECT amount FROM point_ledger WHERE operation_id = ? AND kind = ?').bind(operationId, 'reserve').first<{ amount: number }>();
    if (!reserve || reserve.amount !== amount) throw new DomainError('CONFLICT', 'Invalid point capture');
    const entryId = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.db.batch([
      this.db.prepare("UPDATE operations SET settlement_kind = 'capture' WHERE operation_id = ? AND status IN ('running','delivery_pending') AND settlement_kind IS NULL").bind(operationId),
      this.db.prepare("INSERT INTO point_ledger (entry_id, operation_id, user_id, kind, amount, created_at, metadata_json) SELECT ?, ?, ?, 'capture', ?, ?, '{}' FROM operations WHERE operation_id = ? AND settlement_kind = 'capture' AND NOT EXISTS (SELECT 1 FROM point_ledger WHERE operation_id = ? AND kind = 'capture')").bind(entryId, operationId, userId, amount, now, operationId, operationId),
    ]);
    const created = await this.db.prepare('SELECT entry_id FROM point_ledger WHERE entry_id = ?').bind(entryId).first<{ entry_id: string }>();
    if (!created) {
      const settled = await this.db.prepare('SELECT settlement_kind FROM operations WHERE operation_id = ?').bind(operationId).first<{ settlement_kind: string | null }>();
      if (settled?.settlement_kind === 'capture') return;
      throw new DomainError('CONFLICT', 'Point capture conflicted with another settlement');
    }
  }

  async release(userId: string, operationId: string, amount: number): Promise<void> {
    this.validateAmount(amount);
    if (amount === 0) return;
    const existing = await this.db.prepare('SELECT entry_id FROM point_ledger WHERE operation_id = ? AND kind = ?').bind(operationId, 'release').first<{ entry_id: string }>();
    if (existing) return;
    const reserve = await this.db.prepare('SELECT amount, metadata_json FROM point_ledger WHERE operation_id = ? AND kind = ?').bind(operationId, 'reserve').first<{ amount: number; metadata_json: string }>();
    if (!reserve || reserve.amount !== amount) throw new DomainError('CONFLICT', 'Invalid point release');
    const meta = JSON.parse(reserve.metadata_json) as ReserveMeta;
    const now = new Date().toISOString();
    const entryId = crypto.randomUUID();
    const results = await this.db.batch([
      this.db.prepare("UPDATE operations SET settlement_kind = 'release' WHERE operation_id = ? AND status IN ('created','reserved','running','delivery_pending') AND settlement_kind IS NULL").bind(operationId),
      this.db.prepare("INSERT INTO point_ledger (entry_id, operation_id, user_id, kind, amount, created_at, metadata_json) SELECT ?, ?, ?, 'release', ?, ?, ? FROM operations WHERE operation_id = ? AND settlement_kind = 'release' AND NOT EXISTS (SELECT 1 FROM point_ledger WHERE operation_id = ? AND kind = 'release')").bind(entryId, operationId, userId, amount, now, JSON.stringify(meta), operationId, operationId),
      this.db.prepare("UPDATE users SET daily_points_remaining = daily_points_remaining + ?, balance_points = balance_points + ?, updated_at = ? WHERE id = ? AND EXISTS (SELECT 1 FROM point_ledger WHERE entry_id = ?)").bind(meta.daily, meta.balance, now, userId, entryId),
    ]);
    if ((results[1]?.meta?.changes ?? 0) === 1 && (results[2]?.meta?.changes ?? 0) !== 1) {
      throw new DomainError('CONFLICT', 'Point release could not restore the user balance');
    }
    if ((results[1]?.meta?.changes ?? 0) === 0) {
      const settled = await this.db.prepare('SELECT settlement_kind FROM operations WHERE operation_id = ?').bind(operationId).first<{ settlement_kind: string | null }>();
      if (settled?.settlement_kind === 'capture' || (await this.db.prepare('SELECT entry_id FROM point_ledger WHERE operation_id = ? AND kind = ?').bind(operationId, 'release').first())) return;
      throw new DomainError('CONFLICT', 'Point release conflicted with another settlement');
    }
    const user = await this.db.prepare('SELECT balance_points FROM users WHERE id = ?').bind(userId).first<{ balance_points: number }>();
    if (user) assertNonNegativeBalance(user.balance_points);
  }

  private validateAmount(amount: number): void { if (!Number.isInteger(amount) || amount < 0) throw new DomainError('INVALID_INPUT', 'Points amount must be a non-negative integer'); }
}
