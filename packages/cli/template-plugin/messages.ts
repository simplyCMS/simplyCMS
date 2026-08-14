import type { PluginMessages } from '@simplycms/plugin-sdk';

// Каталог плагіна: ключі ЗОБОВʼЯЗАНІ мати префікс plugin.__PLUGIN_NAME__.
// (неймспейс проти колізій із ядром та іншими плагінами); en дзеркалить uk
// 1:1 — парність стереже tests/plugin-messages-parity.test.ts.
export const messages = {
  uk: {
    'plugin.__PLUGIN_NAME__.title': '__PLUGIN_NAME__',
  },
  en: {
    'plugin.__PLUGIN_NAME__.title': '__PLUGIN_NAME__',
  },
} satisfies PluginMessages;

/** Локальний union ключів — перевірка одруків у межах власного каталогу. */
export type PluginKey = keyof typeof messages.uk;
