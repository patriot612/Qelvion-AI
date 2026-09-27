import { InlineKeyboard } from 'grammy';

export function toolsKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔎 Поиск', 'tools:search').text('📄 Документы', 'tools:documents').row()
    .text('🎭 Роли', 'tools:roles').text('🎙 Голос', 'tools:voice').row()
    .text('🎵 Аудио', 'tools:audio');
}

export function searchKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('↩️ Выйти из поиска', 'tools:search:exit');
}

export function toolsText(): string {
  return ['🛠 Инструменты', '', '🔎 Поиск — отдельный Search Mode через SearXNG.', '📄 Документы и голосовые функции используют отдельные heavy-task paths.'].join('\n');
}

export function searchText(): string {
  return ['🔎 Search Mode', '', 'Каждое следующее сообщение будет отправлено в SearXNG, после чего выбранная Search Editor модель сформирует ответ только на основе найденных источников.', '', 'Обычный Chat Mode и его история здесь не используются.', '', 'Отправьте поисковый запрос.'].join('\n');
}
