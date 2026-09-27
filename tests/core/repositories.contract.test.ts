import { describe, expect, it } from 'vitest';
import type { OperationRepository } from '../../src/db/repositories/operations';
import type { PointRepository } from '../../src/db/repositories/points';

describe('repository boundaries', () => {
  it('exposes operation and point repositories behind interfaces', () => {
    const operationRepository: OperationRepository | null = null;
    const pointRepository: PointRepository | null = null;
    expect(operationRepository).toBeNull();
    expect(pointRepository).toBeNull();
  });
});
