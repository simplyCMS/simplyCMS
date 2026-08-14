import { CORE_VERSION, satisfies } from '@simplycms/objects/semver';

/** Звіт валідації модуля плагіна: помилки → skip, попередження → журнал. */
export interface PluginModuleValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Pure-валідатор модуля плагіна — аналог `validateThemeModule`, але з
 * МʼЯКШОЮ політикою (спека §8 «ніяких падінь»): помилки означають «модуль
 * пропустити», попередження — «зареєструвати, але записати в журнал».
 * Рішення, що робити зі звітом, — за викликачем (`bootstrapPlugins` логує
 * і пропускає; CLI може бути суворішим).
 *
 * Несумісний `engines.simplycms` на 0.x — попередження, не помилка
 * (рішення Р5 плану Фази 3): строгий фейл — політика реліз-потяга v1.0.
 */
export function validatePluginModule(
  value: unknown,
  coreVersion: string = CORE_VERSION,
): PluginModuleValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(value) || typeof value.register !== 'function') {
    return {
      ok: false,
      errors: ['модуль не має register(registry) — це не PluginModule'],
      warnings,
    };
  }

  const manifest = value.manifest;
  if (manifest === undefined) {
    warnings.push(
      'модуль без manifest — метадані в БД підуть дефолтами (0.0.0)',
    );
    return { ok: errors.length === 0, errors, warnings };
  }

  if (!isRecord(manifest)) {
    errors.push('manifest не є обʼєктом');
    return { ok: false, errors, warnings };
  }

  for (const field of ['name', 'displayName', 'version'] as const) {
    if (typeof manifest[field] !== 'string' || manifest[field] === '') {
      errors.push(`manifest.${field} обовʼязковий рядок`);
    }
  }

  const engines = manifest.engines;
  if (engines === undefined) {
    warnings.push(
      'manifest.engines.simplycms відсутній — сумісність із ядром не декларована',
    );
  } else if (!isRecord(engines) || typeof engines.simplycms !== 'string') {
    errors.push('manifest.engines.simplycms має бути рядком-діапазоном');
  } else {
    try {
      if (!satisfies(coreVersion, engines.simplycms)) {
        warnings.push(
          `engines.simplycms "${engines.simplycms}" не покриває ядро ` +
            `${coreVersion} — плагін може бути несумісним`,
        );
      }
    } catch (error) {
      warnings.push(
        `engines.simplycms не розпарсився: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  const messages = value.messages ?? (value.definition as { messages?: unknown } | undefined)?.messages;
  if (messages !== undefined) {
    if (!isRecord(messages)) {
      errors.push('messages має бути обʼєктом Partial<Record<Locale, …>>');
    } else {
      const name = typeof manifest.name === 'string' ? manifest.name : '';
      const prefix = `plugin.${name}.`;
      for (const [locale, catalog] of Object.entries(messages)) {
        if (!isRecord(catalog)) {
          errors.push(`messages.${locale} має бути Record<string, string>`);
          continue;
        }
        for (const [key, text] of Object.entries(catalog)) {
          if (typeof text !== 'string') {
            errors.push(`messages.${locale}.${key} має бути рядком`);
          }
          if (name && !key.startsWith(prefix)) {
            warnings.push(
              `ключ "${key}" без префікса "${prefix}" — ризик колізії ` +
                `з MessageKey ядра чи іншим плагіном`,
            );
          }
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
    errors.push('definition.settings має бути Zod-схемою (z.object)');
  }

  return { ok: errors.length === 0, errors, warnings };
}
