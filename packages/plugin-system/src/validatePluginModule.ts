import { CORE_VERSION, satisfies } from '@simplycms/objects/semver';
import type { PluginModule } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Pure-валідатор модуля плагіна — той самий ідіом, що `validateThemeModule`:
 * порушення контракту — `throw` (діагностика для АВТОРА плагіна),
 * підозри — `console.warn`. Живе тут, а не в plugin-sdk, бо його кличе
 * `bootstrapPlugins`; SDK лише реекспортує.
 *
 * Мʼяку політику спеки §8 («ніяких падінь») забезпечує ВИКЛИКАЧ: bootstrap
 * ловить throw і пропускає модуль, не валячи застосунок. Несумісний
 * `engines.simplycms` — НЕ помилка, а попередження (рішення Р5 плану Фази 3:
 * warn-режим на 0.x; строгий фейл — політика реліз-потяга v1.0).
 */
export function validatePluginModule(
  value: unknown,
  coreVersion: string = CORE_VERSION,
): asserts value is PluginModule {
  if (!isRecord(value) || typeof value.register !== 'function') {
    throw new Error(
      '[plugin] модуль не має register(registry) — це не PluginModule',
    );
  }

  const manifest = value.manifest;
  if (manifest === undefined) {
    console.warn(
      '[plugin] модуль без manifest — метадані в БД підуть дефолтами (0.0.0)',
    );
    return;
  }

  if (!isRecord(manifest)) {
    throw new Error('[plugin] manifest не є обʼєктом');
  }

  for (const field of ['name', 'displayName', 'version'] as const) {
    if (typeof manifest[field] !== 'string' || manifest[field] === '') {
      throw new Error(`[plugin] manifest.${field} — обовʼязковий рядок`);
    }
  }
  const name = manifest.name as string;

  const engines = manifest.engines;
  if (engines === undefined) {
    console.warn(
      `[plugin] "${name}": engines.simplycms відсутній — сумісність із ядром не декларована`,
    );
  } else if (!isRecord(engines) || typeof engines.simplycms !== 'string') {
    throw new Error(
      `[plugin] "${name}": manifest.engines.simplycms має бути рядком-діапазоном`,
    );
  } else {
    try {
      if (!satisfies(coreVersion, engines.simplycms)) {
        console.warn(
          `[plugin] "${name}": engines.simplycms "${engines.simplycms}" не покриває ядро ${coreVersion} — плагін може бути несумісним`,
        );
      }
    } catch (error) {
      console.warn(
        `[plugin] "${name}": engines.simplycms не розпарсився: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  const messages =
    value.messages ??
    (value.definition as { messages?: unknown } | undefined)?.messages;
  if (messages !== undefined) {
    if (!isRecord(messages)) {
      throw new Error(
        `[plugin] "${name}": messages має бути Partial<Record<Locale, Record<string, string>>>`,
      );
    }
    const prefix = `plugin.${name}.`;
    for (const [locale, catalog] of Object.entries(messages)) {
      if (!isRecord(catalog)) {
        throw new Error(
          `[plugin] "${name}": messages.${locale} має бути Record<string, string>`,
        );
      }
      for (const [key, text] of Object.entries(catalog)) {
        if (typeof text !== 'string') {
          throw new Error(
            `[plugin] "${name}": messages.${locale}.${key} має бути рядком`,
          );
        }
        if (!key.startsWith(prefix)) {
          console.warn(
            `[plugin] "${name}": ключ "${key}" без префікса "${prefix}" — ризик колізії з MessageKey ядра чи іншим плагіном`,
          );
        }
      }
    }
  }

  const settings = (value.definition as { settings?: unknown } | undefined)
    ?.settings;
  if (
    settings !== undefined &&
    (!isRecord(settings) || typeof settings.safeParse !== 'function')
  ) {
    throw new Error(
      `[plugin] "${name}": definition.settings має бути Zod-схемою (z.object)`,
    );
  }
}
