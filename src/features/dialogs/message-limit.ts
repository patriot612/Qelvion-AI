export function canAppendMessage(currentCount: number, messageLimit: number): boolean {
  return currentCount >= 0 && messageLimit > 0 && currentCount < messageLimit;
}
