import { describe, expect, it, vi } from 'vitest';
import { deliverMediaResult } from '../../src/queue/consumer/delivery';

vi.mock('grammy', async () => {
  class MockInputFile { constructor(public data: unknown, public filename?: string) {} }
  const api = { sendPhoto: vi.fn(), sendAudio: vi.fn(), sendVoice: vi.fn(), sendDocument: vi.fn() };
  class Bot { api = api; constructor() {} }
  return { Bot, InputFile: MockInputFile };
});

describe('media delivery boundary', () => {
  const env = { TELEGRAM_BOT_TOKEN: 'token' } as never;

  it('delivers image data URL through Telegram photo API', async () => {
    const { Bot } = await import('grammy');
    const bot = new Bot('token');
    const task = { taskId: 't', operationId: 'o', userId: 'u', type: 'image' as const, model: 'm', prompt: 'p', templateKey: null, metadata: { telegramUserId: 123 } };
    await deliverMediaResult(env, task, 'data:image/png;base64,YQ==');
    expect(bot.api.sendPhoto).toHaveBeenCalled();
  });

  it('delivers textual document output as a Telegram text document', async () => {
    const { Bot } = await import('grammy');
    const bot = new Bot('token');
    const task = { taskId: 't', operationId: 'o', userId: 'u', type: 'document' as const, model: 'm', prompt: 'p', templateKey: null, metadata: { telegramUserId: 123 } };
    await deliverMediaResult(env, task, 'plain text');
    expect(bot.api.sendDocument).toHaveBeenCalled();
  });
});
