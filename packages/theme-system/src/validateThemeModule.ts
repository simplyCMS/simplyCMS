import { CORE_VERSION, satisfies } from '@simplycms/objects/semver';
import type { ThemeModule } from './types';

/**
 * Відомі ключі `ThemeModule.views` (контракт v3) — рівно пʼять канонічних
 * сторінок вітрини. Список публічний: на ньому тримається і валідація форми
 * тут, і перелік фікстур conformance-kit-а.
 */
export const THEME_VIEW_KEYS = [
  'Home',
  'Catalog',
  'CatalogSection',
  'ProductDetail',
  'Cart',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Публічний pure-валідатор модуля теми (контракт v2).
 *
 * Тема приходить із зовнішнього пакета, тому її форма — `unknown` доти, доки
 * не перевірена тут. Реєстр не має власної приватної валідації: єдина
 * реалізація контракту живе в цій функції.
 */
export function validateThemeModule(m: unknown): asserts m is ThemeModule {
  if (!isRecord(m)) {
    throw new Error('[theme] Модуль теми має бути обʼєктом');
  }

  const { manifest, tokens, components, settings, messages, fonts, views } = m;

  if (!isRecord(manifest)) {
    throw new Error('[theme] Відсутній manifest');
  }

  if (
    typeof manifest.name !== 'string' ||
    typeof manifest.displayName !== 'string' ||
    typeof manifest.version !== 'string'
  ) {
    throw new Error(
      '[theme] Неповний manifest: потрібні name, displayName, version',
    );
  }

  const engines = manifest.engines;
  if (!isRecord(engines) || typeof engines.simplycms !== 'string') {
    throw new Error(
      `[theme] "${manifest.name}": manifest.engines.simplycms обовʼязковий (діапазон сумісності з ядром)`,
    );
  }

  // Реальна semver-перевірка діапазону — warn-режим на 0.x (рішення Р5 плану
  // Фази 3): невідповідність не валить тему, строгий фейл — політика
  // реліз-потяга v1.0. Нерозбірливий діапазон — теж warn, з причиною.
  try {
    if (!satisfies(CORE_VERSION, engines.simplycms)) {
      console.warn(
        `[theme] "${manifest.name}": engines.simplycms "${engines.simplycms}" ` +
          `не покриває ядро ${CORE_VERSION} — тема може бути несумісною`,
      );
    }
  } catch (error) {
    console.warn(
      `[theme] "${manifest.name}": engines.simplycms не розпарсився: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!isRecord(tokens)) {
    throw new Error(`[theme] "${manifest.name}": відсутні tokens`);
  }

  if (!isRecord(components)) {
    throw new Error(`[theme] "${manifest.name}": відсутні components`);
  }

  if (typeof components.Header !== 'function') {
    throw new Error(`[theme] "${manifest.name}": відсутній components.Header`);
  }

  if (typeof components.Footer !== 'function') {
    throw new Error(`[theme] "${manifest.name}": відсутній components.Footer`);
  }

  if (settings !== undefined && !isRecord(settings)) {
    throw new Error(
      `[theme] "${manifest.name}": settings мають бути обʼєктом схеми налаштувань`,
    );
  }

  if (messages !== undefined) {
    if (!isRecord(messages)) {
      throw new Error(
        `[theme] "${manifest.name}": messages мають бути обʼєктом каталогів за локаллю`,
      );
    }
    for (const [locale, catalog] of Object.entries(messages)) {
      if (!isRecord(catalog)) {
        throw new Error(
          `[theme] "${manifest.name}": messages.${locale} має бути обʼєктом рядок→рядок`,
        );
      }
      for (const [key, value] of Object.entries(catalog)) {
        if (typeof value !== 'string') {
          throw new Error(
            `[theme] "${manifest.name}": messages.${locale}.${key} має бути рядком`,
          );
        }
      }
    }
  }

  // Мʼяка перевірка форми `fonts` (контракт v2.2, Р4): рантайм-фільтрація
  // валідних https:-URL — робота `safeFontStylesheets`, тут лише форма.
  if (fonts !== undefined) {
    if (!Array.isArray(fonts)) {
      throw new Error(`[theme] "${manifest.name}": fonts має бути масивом`);
    }
    fonts.forEach((entry, index) => {
      if (!isRecord(entry) || typeof entry.stylesheet !== 'string') {
        throw new Error(
          `[theme] "${manifest.name}": fonts[${index}] має бути обʼєктом { stylesheet: string }`,
        );
      }
    });
  }

  // Мʼяка перевірка форми `views` (контракт v3) — за ідіомою блоку `fonts`:
  // тут лише форма, семантику (реквізити, крайні стани) доводить
  // conformance-kit. Тема без `views` валідна — поле опційне.
  if (views !== undefined) {
    // 🔴 `isRecord` пропускає масив (typeof [] === 'object'), а масив views —
    // це не мапа сторінок: відсікаємо явно.
    if (!isRecord(views) || Array.isArray(views)) {
      throw new Error(
        `[theme] "${manifest.name}": views мають бути обʼєктом { <сторінка>: React-компонент }`,
      );
    }
    for (const [key, view] of Object.entries(views)) {
      if (!(THEME_VIEW_KEYS as readonly string[]).includes(key)) {
        throw new Error(
          `[theme] "${manifest.name}": невідомий views.${key}; дозволені: ${THEME_VIEW_KEYS.join(', ')}`,
        );
      }
      if (typeof view !== 'function') {
        throw new Error(
          `[theme] "${manifest.name}": views.${key} має бути React-компонентом`,
        );
      }
    }
  }
}
