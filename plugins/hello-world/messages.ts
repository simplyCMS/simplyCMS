import type { PluginMessages } from '@simplycms/plugin-sdk';

/**
 * Каталог повідомлень плагіна — дзеркало механізму тем (`ThemeModule.messages`).
 * Ключі зобовʼязані мати префікс `plugin.hello-world.` — неймспейс виключає
 * колізії з `MessageKey` ядра та іншими плагінами.
 */
export const messages = {
  uk: {
    'plugin.hello-world.title': 'Hello, World!',
    'plugin.hello-world.body':
      'Віджет із плагіна hello-world — доказ того, що контур плагінів працює.',
  },
  en: {
    'plugin.hello-world.title': 'Hello, World!',
    'plugin.hello-world.body':
      'A widget from the hello-world plugin — proof the plugin contour works.',
  },
} satisfies PluginMessages;

/** Локальний union ключів — перевірка одруків у межах ВЛАСНОГО каталогу. */
export type HelloWorldKey = keyof typeof messages.uk;
