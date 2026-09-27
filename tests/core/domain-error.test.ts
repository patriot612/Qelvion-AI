import { describe, expect, it } from 'vitest';
import { DomainError } from '../../src/core/errors/domain';

describe('DomainError', () => {
  it('preserves a normalized code and retryability', () => {
    const error = new DomainError('PROVIDER_ERROR', 'temporary provider failure', true);
    expect(error.code).toBe('PROVIDER_ERROR');
    expect(error.retryable).toBe(true);
    expect(error.message).toBe('temporary provider failure');
  });
});
