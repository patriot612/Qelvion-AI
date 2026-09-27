import { describe, expect, it } from 'vitest';
import {
  operationIdempotencyKey,
  paymentIdempotencyKey,
  updateIdempotencyKey,
} from '../../src/core/idempotency/keys';

describe('idempotency keys', () => {
  it('creates stable namespaced keys', () => {
    expect(updateIdempotencyKey(42)).toBe('telegram:update:42');
    expect(operationIdempotencyKey('op-1')).toBe('operation:op-1');
    expect(paymentIdempotencyKey('pay-1')).toBe('payment:pay-1');
  });
});
