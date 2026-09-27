export interface DailyPointState { granted: number; remaining: number; resetAt: string; }
export function applyDailyReset(state: DailyPointState, now: Date, nextGrant: number): DailyPointState {
  if (new Date(state.resetAt) > now) return state;
  return { granted: nextGrant, remaining: nextGrant, resetAt: new Date(now.getTime() + 86400000).toISOString() };
}
