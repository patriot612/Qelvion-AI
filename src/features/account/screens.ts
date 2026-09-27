export interface AccountSnapshot {
  balance: number;
  dailyPoints: number;
  nextDailyRefill: string;
  status: string;
}

export function renderAccount(snapshot: AccountSnapshot): string {
  return [
    '👤 Аккаунт',
    '',
    `Баланс: ${snapshot.balance} points`,
    `Получено сегодня: ${snapshot.dailyPoints} points`,
    `Следующее пополнение: ${snapshot.nextDailyRefill}`,
    `Статус: ${snapshot.status}`,
  ].join('\n');
}
