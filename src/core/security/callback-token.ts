export interface CallbackTokenRecord {
  token: string;
  userId: string;
  action: string;
  expiresAt: string;
}

export function isCallbackTokenUsable(record: CallbackTokenRecord, userId: string, now = new Date()): boolean {
  return record.userId === userId && new Date(record.expiresAt) > now;
}
