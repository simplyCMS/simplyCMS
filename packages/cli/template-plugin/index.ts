import { createElement } from 'react';
import { definePlugin, usePluginT } from 'simplycms/plugin-sdk';
import { messages, type PluginKey } from './messages';

// Стартовий каркас плагіна: один слот на дашборді адмінки. Повний приклад
// (таблиця plg_*, adminRoutes, Zod-settings) — @simplycms/plugin-faq.
function DashboardWidget() {
  const t = usePluginT<PluginKey>(messages);
  return createElement(
    'div',
    { className: 'rounded-lg border bg-card p-4 text-card-foreground' },
    createElement(
      'h3',
      { className: 'font-semibold' },
      t('plugin.__PLUGIN_NAME__.title'),
    ),
  );
}

export default definePlugin({
  name: '__PLUGIN_NAME__',
  displayName: '__PLUGIN_NAME__',
  version: '0.1.0',
  engines: { simplycms: '__CORE_RANGE__' },
  slots: { 'admin.dashboard.widgets': DashboardWidget },
  messages,
});
