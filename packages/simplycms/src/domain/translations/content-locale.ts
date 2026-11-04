import type { ContentLocale } from 'simplycms/contracts';
import { LANGUAGE_CODE_FORMAT } from './text-locale';

/**
 * Єдиний конструктор `ContentLocale`: код має форму BCP 47 (`LANGUAGE_CODE_FORMAT`).
 * Викликають лише межі, що самі отримали код з довіреного джерела чи розібрали його:
 * `toLocaleSet`, `readClientLocaleSet`, `localeInput`, `primaryLocaleCode` (читання `languages`),
 * `NO_LOCALES` (`domain/request-locale.ts`) і фікстури тестів. Решта коду значення
 * лише передає; приведення `as ContentLocale` поза цією функцією заборонене.
 */
export function checkedContentLocale(code: string): ContentLocale {
  if (!LANGUAGE_CODE_FORMAT.test(code)) {
    throw new Error(`[simplycms/domain] хибний код мови контенту: «${code}»`);
  }
  return code as ContentLocale;
}
