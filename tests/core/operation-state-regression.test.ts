import { describe, expect, it } from 'vitest';
import { assertOperationTransition } from '../../src/core/operations/state';

describe('operation retry safety', () => {
  it('does not permit terminal succeeded operation to restart', () => {
    expect(() => assertOperationTransition('succeeded', 'running')).toThrow();
  });

  it('does not permit terminal failed operation to restart', () => {
    expect(() => assertOperationTransition('failed', 'running')).toThrow();
  });

  it('does not permit terminal cancelled operation to restart', () => {
    expect(() => assertOperationTransition('cancelled', 'running')).toThrow();
  });
});
