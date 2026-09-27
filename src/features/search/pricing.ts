export function searchPrice(points: number): number {
  if (!Number.isInteger(points) || points < 0) throw new Error('Search price must be a non-negative integer');
  return points;
}
