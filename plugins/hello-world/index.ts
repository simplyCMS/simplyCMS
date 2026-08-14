import { createElement } from 'react';
import { definePlugin, usePluginT } from '@simplycms/plugin-sdk';
import { messages, type HelloWorldKey } from './messages';

/**
 * Референс-плагін: МІНІМАЛЬНИЙ приклад контракту `definePlugin` —
 * один слот на дашборді адмінки + власний каталог i18n. Повний приклад
 * (таблиця plg_*, adminRoutes, Zod-settings) — `@simplycms/plugin-faq`.
 *
 * `.ts`, а не `.tsx`: плагін — це звичайний пакет без JSX-тулчейну,
 * тож розмітка будується через `createElement`.
 */
function HelloWorldWidget() {
  const t = usePluginT<HelloWorldKey>(messages);
  return createElement(
    'div',
    { className: 'rounded-lg border bg-card p-4 text-card-foreground' },
    createElement(
      'h3',
      { className: 'font-semibold' },
      t('plugin.hello-world.title'),
    ),
    createElement(
      'p',
      { className: 'mt-1 text-sm text-muted-foreground' },
      t('plugin.hello-world.body'),
    ),
  );
}

export default definePlugin({
  name: 'hello-world',
  displayName: 'Hello World',
  version: '0.1.0',
  engines: { simplycms: '>=0.3.0' },
  // Метадані реєстру — англійською (конвенція Р6 плану Фази 3: показуються
  // з БД-рядка, а не з каталогу повідомлень).
  description:
    'Demo plugin: a dashboard widget proving the plugin contour works.',
  author: 'SimplyCMS',
  slots: { 'admin.dashboard.widgets': HelloWorldWidget },
  messages,
});
