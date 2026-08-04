import { createElement } from 'react';
import type {
  HookRegistryInterface,
  PluginManifest,
  PluginModule,
} from '@simplycms/plugins/types';

/**
 * Референс-плагін: мінімальний приклад контракту `PluginModule`.
 * Чіпляє один віджет на дашборд адмінки (`admin.dashboard.widgets`).
 *
 * `.ts`, а не `.tsx`: плагін — це звичайний пакет без JSX-тулчейну,
 * тож розмітка будується через `createElement`.
 */
const manifest: PluginManifest = {
  name: 'hello-world',
  displayName: 'Hello World',
  version: '0.1.0',
  description: 'Демо-плагін: віджет на дашборді адмінки.',
  author: 'SimplyCMS',
  hooks: [{ name: 'admin.dashboard.widgets' }],
};

const PLUGIN_NAME = manifest.name;
const HOOK_NAME = 'admin.dashboard.widgets';

function HelloWorldWidget() {
  return createElement(
    'div',
    { className: 'rounded-lg border bg-card p-4 text-card-foreground' },
    createElement('h3', { className: 'font-semibold' }, 'Hello, World!'),
    createElement(
      'p',
      { className: 'mt-1 text-sm text-muted-foreground' },
      'Віджет із плагіна hello-world — доказ того, що контур плагінів працює.',
    ),
  );
}

const plugin: PluginModule = {
  manifest,
  register(registry: HookRegistryInterface) {
    registry.register(HOOK_NAME, PLUGIN_NAME, () =>
      createElement(HelloWorldWidget, { key: PLUGIN_NAME }),
    );
  },
  unregister(registry: HookRegistryInterface) {
    registry.unregister(HOOK_NAME, PLUGIN_NAME);
  },
};

export default plugin;
