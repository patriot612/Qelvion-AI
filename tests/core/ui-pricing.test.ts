import { describe, expect, it } from 'vitest';
import { canAppendMessage } from '../../src/features/dialogs/message-limit';
import { speedCost } from '../../src/features/images/speeds';
import { splitPaymentHistory } from '../../src/features/billing/history';

describe('business configuration rules', () => {
  it('enforces the message limit before appending', () => {
    expect(canAppendMessage(49, 50)).toBe(true);
    expect(canAppendMessage(50, 50)).toBe(false);
  });

  it('keeps fast image mode at zero surcharge when configured so', () => {
    expect(speedCost('fast', { fast: 0, standard: 2, long: 5 })).toBe(0);
  });

  it('splits paid and unpaid payment history', () => {
    const result = splitPaymentHistory([
      { paymentId: 'a', status: 'paid', points: 10, createdAt: 'x' },
      { paymentId: 'b', status: 'unpaid', points: 20, createdAt: 'y' },
    ]);
    expect(result.paid).toHaveLength(1);
    expect(result.unpaid).toHaveLength(1);
  });
});
