export async function isDuplicateUpdate(db: D1Database, updateId: number): Promise<boolean> {
  const existing = await db.prepare('SELECT update_id FROM processed_updates WHERE update_id = ?').bind(updateId).first();
  if (existing) return true;
  const now = new Date().toISOString();
  try {
    await db.prepare('INSERT INTO processed_updates (update_id, processed_at) VALUES (?, ?)').bind(updateId, now).run();
    return false;
  } catch {
    return true;
  }
}
