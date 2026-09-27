import { InputFile } from 'grammy';
import type { Bot } from 'grammy';
import type { Env } from '../../env';
import type { HeavyTaskMessage } from '../tasks/types';

type MediaPayload = { result: string; filename?: string; mimeType?: string };

function dataUrlToBytes(value: string): { bytes: Uint8Array; mimeType: string } | null {
  const match = /^data:([^;,]+)?;base64,(.+)$/s.exec(value);
  if (!match) return null;
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return { bytes, mimeType: match[1] ?? 'application/octet-stream' };
}

export async function deliverMediaResult(
  env: Env,
  task: HeavyTaskMessage,
  result: string,
): Promise<void> {
  const telegramUserId = Number(task.metadata.telegramUserId);
  if (!Number.isSafeInteger(telegramUserId) || telegramUserId <= 0) throw new Error('Missing Telegram delivery target');
  const bot: Bot = new (await import('grammy')).Bot(env.TELEGRAM_BOT_TOKEN);
  const data = dataUrlToBytes(result);
  const payload: MediaPayload = { result };

  switch (task.type) {
    case 'image':
      if (data) {
        await bot.api.sendPhoto(telegramUserId, new InputFile(data.bytes, 'qelvion-image.bin'), { caption: 'Готово.' });
      } else {
        await bot.api.sendPhoto(telegramUserId, payload.result, { caption: 'Готово.' });
      }
      return;
    case 'audio':
      if (data) {
        await bot.api.sendAudio(telegramUserId, new InputFile(data.bytes, 'qelvion-audio.mp3'), { caption: 'Готово.' });
      } else {
        await bot.api.sendAudio(telegramUserId, payload.result, { caption: 'Готово.' });
      }
      return;
    case 'voice':
      if (data) {
        await bot.api.sendVoice(telegramUserId, new InputFile(data.bytes, 'qelvion-voice.ogg'), { caption: 'Готово.' });
      } else {
        await bot.api.sendVoice(telegramUserId, payload.result, { caption: 'Готово.' });
      }
      return;
    case 'document': {
      const bytes = new TextEncoder().encode(result);
      await bot.api.sendDocument(telegramUserId, new InputFile(bytes, 'qelvion-result.txt'), { caption: 'Готово.' });
      return;
    }
  }
}
