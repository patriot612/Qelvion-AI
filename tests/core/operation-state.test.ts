import { describe, expect, it } from 'vitest';
import { DomainError } from '../../src/core/errors/domain';
import { assertOperationTransition } from '../../src/core/operations/state';

describe('operation state machine', () => {
  it('allows reservation to running', () => {
    expect(() => assertOperationTransition('reserved', 'running')).not.toThrow();
  });

  it('rejects running to reserved', () => {
    expect(() => assertOperationTransition('running', 'reserved')).toThrow(DomainError);
  });
});
