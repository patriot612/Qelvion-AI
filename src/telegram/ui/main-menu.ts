import { Keyboard } from 'grammy';

export function mainMenuKeyboard(): Keyboard {
  return new Keyboard()
    .text('💬 Чат').text('🎨 Изображения').row()
    .text('🤖 Модели').text('🗂 Диалоги').row()
    .text('🛠 Инструменты').text('👤 Аккаунт')
    .resized();
}
