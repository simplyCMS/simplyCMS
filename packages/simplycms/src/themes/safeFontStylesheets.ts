import type { ThemeFontSource } from './types';

/**
 * Символи, які видають спробу вирватись із значення атрибута `href`
 * (лапки, кутові дужки) чи протягнути пробіл там, де його бути не може.
 * Гігієна проти одруків, не security-межа — теми довірені (Р10 Фази 4).
 */
const UNSAFE_URL = /["'<>\s]/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Чи є значення валідним абсолютним `https:`-URL без небезпечних символів. */
function isSafeHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim() === '') return false;
  if (UNSAFE_URL.test(value)) return false;

  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Відфільтрувати `ThemeModule.fonts` до масиву валідних `https:`-URL
 * зовнішніх stylesheet-ів (контракт v2.2, Р4).
 *
 * Приймає `unknown`, бо `fonts` приходить із зовнішнього пакета теми —
 * форма не гарантована до валідації. Невалідний запис не валить рендер:
 * пропускається з попередженням у консоль.
 *
 * 🔴 Субшлях-експорт (Р11): цей модуль НЕ реекспортується з barrel-а
 * `index.ts` — barrel тягне `getActiveThemeSSR` →
 * `simplycms/supabase/anon-client`, і імпорт barrel-а з клієнтського
 * `ThemeFonts` затягнув би серверний код у клієнтський бандл. Єдиний
 * дозволений імпорт — `simplycms/themes/safeFontStylesheets`.
 */
export function safeFontStylesheets(fonts: unknown): string[] {
  if (!Array.isArray(fonts)) return [];

  const result: string[] = [];

  for (const entry of fonts) {
    const stylesheet = isRecord(entry)
      ? (entry as Partial<ThemeFontSource>).stylesheet
      : undefined;

    if (isSafeHttpsUrl(stylesheet)) {
      result.push(stylesheet);
    } else {
      console.warn(
        '[theme] Пропущено невалідний запис fonts (очікується https: URL):',
        entry,
      );
    }
  }

  return result;
}
