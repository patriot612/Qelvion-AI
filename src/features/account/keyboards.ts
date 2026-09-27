import { InlineKeyboard } from 'grammy';

export function accountKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('Тарифы', 'account:tariffs').text('История операций', 'account:operations').row()
    .text('Лимиты', 'account:limits').text('Настройки', 'account:settings');
}
