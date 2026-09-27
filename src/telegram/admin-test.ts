export function positiveIntForTest(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 0) throw new Error('invalid');
  return Number(value);
}
