import { createElement } from 'react';
import type { PluginManifest } from '@simplycms/plugins/types';
import type { PluginDefinition, SdkPluginModule } from './types';

const NAME_RE = /^[a-z][a-z0-9-]*$/;

/**
 * Декларативний вхід автора плагіна (спека §7).
 *
 * Помилки контракту — виняток одразу, при імпорті модуля: автор бачить їх у
 * dev-консолі першим же рендером, а в магазині `bootstrapPlugins` ловить
 * throw у своєму try/catch і пропускає плагін, не валячи застосунок.
 */
export function definePlugin(definition: PluginDefinition): SdkPluginModule {
  const { name } = definition;
  if (!NAME_RE.test(name)) {
    throw new Error(
      `[plugin-sdk] Невалідне імʼя плагіна "${name}": очікується [a-z][a-z0-9-]* ` +
        `(воно стає ключем у БД, префіксом таблиць plg_* і ключів i18n)`,
    );
  }
  if (!definition.displayName || !definition.version) {
    throw new Error(
      `[plugin-sdk] "${name}": displayName і version обовʼязкові`,
    );
  }
  if (typeof definition.engines?.simplycms !== 'string') {
    throw new Error(
      `[plugin-sdk] "${name}": engines.simplycms обовʼязковий ` +
        `(діапазон сумісності з ядром, спека §7)`,
    );
  }

  const slotNames = Object.keys(definition.slots ?? {});
  const hookNames = Object.keys(definition.hooks ?? {});
  const collision = slotNames.find((slot) => hookNames.includes(slot));
  if (collision) {
    throw new Error(
      `[plugin-sdk] "${name}": "${collision}" оголошено і в slots, і в hooks — ` +
        `HookRegistry тримає ОДИН запис на пару (hook, plugin), другий мовчки ` +
        `замінив би перший`,
    );
  }

  const manifest: PluginManifest = {
    name,
    displayName: definition.displayName,
    version: definition.version,
    description: definition.description,
    author: definition.author,
    engines: definition.engines,
    hooks: [...slotNames, ...hookNames].map((hookName) => ({ name: hookName })),
    migrations: definition.migrations,
  };

  return {
    manifest,
    definition,
    messages: definition.messages,
    register(registry) {
      for (const [slot, Component] of Object.entries(definition.slots ?? {})) {
        registry.register(slot, name, (context: unknown) =>
          createElement(Component, { key: `${name}:${slot}`, context }),
        );
      }
      for (const [hook, handler] of Object.entries(definition.hooks ?? {})) {
        registry.register(hook, name, handler);
      }
    },
    unregister(registry) {
      for (const hookName of [...slotNames, ...hookNames]) {
        registry.unregister(hookName, name);
      }
    },
  };
}
