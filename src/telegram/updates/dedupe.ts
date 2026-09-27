const STALE_PROCESSING_MS = 60_000;

export async function claimUpdate(db: D1Database, updateId: number): Promise<boolean> {
  const now = new Date();
  const nowIso = now.toISOString();
  try {
    await db.prepare('INSERT INTO processed_updates (update_id, processed_at, status) VALUES (?, ?, \'processing\')')
      .bind(updateId, nowIso).run();
    return true;
  } catch {
    const existing = await db.prepare('SELECT status, processed_at FROM processed_updates WHERE update_id = ?')
      .bind(updateId).first<{ status: 'processing' | 'completed'; processed_at: string }>();
    if (!existing) throw new Error('Telegram update dedupe state could not be read');
    if (existing.status === 'completed') return false;

    const processedAt = Date.parse(existing.processed_at);
    if (!Number.isFinite(processedAt) || now.getTime() - processedAt < STALE_PROCESSING_MS) return false;

    const reclaimed = await db.prepare('UPDATE processed_updates SET processed_at = ?, status = \'processing\' WHERE update_id = ? AND status = \'processing\' AND processed_at = ?')
      .bind(nowIso, updateId, existing.processed_at).run();
    return (reclaimed.meta?.changes ?? 0) === 1;
  }
}

export async function completeUpdate(db: D1Database, updateId: number): Promise<void> {
  await db.prepare('UPDATE processed_updates SET status = \'completed\', processed_at = ? WHERE update_id = ? AND status = \'processing\'')
    .bind(new Date().toISOString(), updateId).run();
}

export async function releaseUpdate(db: D1Database, updateId: number): Promise<void> {
  await db.prepare('DELETE FROM processed_updates WHERE update_id = ? AND status = \'processing\'')
    .bind(updateId).run();
}
