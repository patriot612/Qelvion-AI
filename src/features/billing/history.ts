export type PaymentHistoryStatus = 'paid' | 'unpaid';

export interface PaymentHistoryItem {
  paymentId: string;
  status: PaymentHistoryStatus;
  points: number;
  createdAt: string;
}

export function splitPaymentHistory(items: readonly PaymentHistoryItem[]): { paid: PaymentHistoryItem[]; unpaid: PaymentHistoryItem[] } {
  return {
    paid: items.filter((item) => item.status === 'paid'),
    unpaid: items.filter((item) => item.status === 'unpaid'),
  };
}
