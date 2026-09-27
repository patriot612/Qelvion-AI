export function hasValidTelegramWebhookSecret(request: Request, expectedSecret: string): boolean {
  const received = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  return Boolean(received && expectedSecret && received === expectedSecret);
}

export async function verifyTelegramWebAppInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 300,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<{ telegramUserId: number; username: string | null }> {
  if (!initData || !botToken) throw new Error('Invalid Telegram initData');
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) throw new Error('Invalid Telegram initData');
  params.delete('hash');
  const authDate = Number(params.get('auth_date'));
  if (!Number.isInteger(authDate) || authDate <= 0 || nowSeconds - authDate > maxAgeSeconds || authDate > nowSeconds + 30) {
    throw new Error('Expired Telegram initData');
  }
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = await crypto.subtle.importKey('raw', new TextEncoder().encode('WebAppData'), 'HMAC', false, ['sign']);
  const derived = await crypto.subtle.sign('HMAC', secretKey, new TextEncoder().encode(botToken));
  const derivedHex = Array.from(new Uint8Array(derived)).map((b) => b.toString(16).padStart(2, '0')).join('');
  const verifyKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(derivedHex), 'HMAC', false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', verifyKey, new TextEncoder().encode(dataCheckString));
  const actual = Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('');
  if (!safeEqualHex(actual, hash)) throw new Error('Invalid Telegram initData');
  const userRaw = params.get('user');
  if (!userRaw) throw new Error('Telegram user is missing');
  const user = JSON.parse(userRaw) as { id: number; username?: string };
  if (!Number.isSafeInteger(user.id) || user.id <= 0) throw new Error('Telegram user is invalid');
  return { telegramUserId: user.id, username: user.username ?? null };
}

export function isAdminTelegramId(configured: string | undefined, telegramUserId: number): boolean {
  if (!configured) return false;
  return configured.split(',').map((value) => value.trim()).filter(Boolean).some((value) => value === String(telegramUserId));
}

function safeEqualHex(a: string, b: string): boolean {
  if (!/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b) || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
