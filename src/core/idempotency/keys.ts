export function updateIdempotencyKey(updateId: number | string): string {
  return `telegram:update:${String(updateId)}`;
}

export function operationIdempotencyKey(operationId: string): string {
  return `operation:${operationId}`;
}

export function paymentIdempotencyKey(providerPaymentId: string): string {
  return `payment:${providerPaymentId}`;
}
