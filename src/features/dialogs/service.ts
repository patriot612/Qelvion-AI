import type { D1Database } from '@cloudflare/workers-types';
import { D1DialogRepository } from '../../db/repositories/dialogs';
import { D1ConfigRepository } from '../../db/repositories/config';
import type { DialogLimits } from './limits';

export async function resolveDialogLimits(db: D1Database, subscriptionStatus: string): Promise<DialogLimits> {
  const config = new D1ConfigRepository(db);
  return {
    activeLimit: await config.getJson<number>(`dialog.${subscriptionStatus}.active_limit`, await config.getJson<number>('dialog.free.active_limit', 5)),
    archivedLimit: await config.getJson<number>(`dialog.${subscriptionStatus}.archived_limit`, await config.getJson<number>('dialog.free.archived_limit', 15)),
    archiveTtlHours: await config.getJson<number>(`dialog.${subscriptionStatus}.archive_ttl_hours`, await config.getJson<number>('dialog.free.archive_ttl_hours', 24)),
    messagesPerDialog: await config.getJson<number>(`dialog.${subscriptionStatus}.messages_per_dialog`, await config.getJson<number>('dialog.free.messages_per_dialog', 50)),
  };
}

export async function archiveDialog(db: D1Database, dialogId: string, limits: DialogLimits): Promise<void> {
  const ttl = new Date(Date.now() + limits.archiveTtlHours * 3600000).toISOString();
  await db.prepare('UPDATE dialogs SET is_archived = 1, archived_at = ?, expires_at = ?, updated_at = ? WHERE dialog_id = ?').bind(new Date().toISOString(), ttl, new Date().toISOString(), dialogId).run();
  await enforceArchivedLimit(db, (await db.prepare('SELECT user_id FROM dialogs WHERE dialog_id = ?').bind(dialogId).first<{user_id:string}>())?.user_id, limits.archivedLimit);
}

export async function enforceDialogLimits(db: D1Database, userId: string, limits: DialogLimits): Promise<void> {
  const active = await db.prepare('SELECT dialog_id FROM dialogs WHERE user_id = ? AND is_archived = 0 ORDER BY updated_at DESC').bind(userId).all<{dialog_id:string}>();
  for (const row of active.results.slice(limits.activeLimit)) {
    await archiveDialog(db, row.dialog_id, limits);
  }
  await enforceArchivedLimit(db, userId, limits.archivedLimit);
  await db.prepare('DELETE FROM dialog_messages WHERE dialog_id IN (SELECT dialog_id FROM dialogs WHERE user_id = ? AND is_archived = 1 AND expires_at IS NOT NULL AND expires_at <= ?)').bind(userId, new Date().toISOString()).run();
  await db.prepare('DELETE FROM dialogs WHERE user_id = ? AND is_archived = 1 AND expires_at IS NOT NULL AND expires_at <= ?').bind(userId, new Date().toISOString()).run();
}

async function enforceArchivedLimit(db: D1Database, userId: string | undefined, limit: number): Promise<void> {
  if (!userId) return;
  const rows = await db.prepare('SELECT dialog_id FROM dialogs WHERE user_id = ? AND is_archived = 1 ORDER BY updated_at DESC').bind(userId).all<{dialog_id:string}>();
  for (const row of rows.results.slice(limit)) {
    await db.prepare('DELETE FROM dialog_messages WHERE dialog_id = ?').bind(row.dialog_id).run();
    await db.prepare('DELETE FROM dialogs WHERE dialog_id = ?').bind(row.dialog_id).run();
  }
}

export async function addUserMessageAndEnforce(db: D1Database, dialogId: string, content: string, limits: DialogLimits): Promise<void> {
  await new D1DialogRepository(db).addMessage(dialogId, 'user', content, limits);
}
