import { describe, expect, it } from 'vitest';
import { positiveIntForTest } from '../../src/telegram/admin-test';

describe('admin contracts', () => {
  it('keeps dangerous values non-negative at the boundary', () => {
    expect(positiveIntForTest(0)).toBe(0);
    expect(() => positiveIntForTest(-1)).toThrow();
    expect(() => positiveIntForTest(1.2)).toThrow();
  });
});
