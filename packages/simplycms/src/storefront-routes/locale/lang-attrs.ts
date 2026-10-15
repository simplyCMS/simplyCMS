/** Напрям тексту мови для `<html dir>`. */
export type TextDirection = 'ltr' | 'rtl';

type WithTextInfo = { getTextInfo?: () => { direction?: string } };

/**
 * Напрям з `Intl.Locale.getTextInfo()` (Node ≥ 24, сучасні браузери): колонки
 * в БД немає, мова сама знає, куди писати. Рушій без `getTextInfo` або з
 * кодом, який `Intl` не розбирає, дає `ltr` — крихка розмітка кореня не має
 * валити всю вітрину через один дивний код мови.
 */
export function dirOf(code: string): TextDirection {
  try {
    const info = (new Intl.Locale(code) as WithTextInfo).getTextInfo?.();
    return info?.direction === 'rtl' ? 'rtl' : 'ltr';
  } catch {
    return 'ltr';
  }
}

/**
 * Атрибути `<html>` сторінки: `lang` = мова сторінки (І37), `dir` — з `Intl`.
 * Host розгортає їх у кореневий `<html>`; тест доводить значення на `/en/x`.
 */
export function htmlLangAttrs(locale: string): {
  lang: string;
  dir: TextDirection;
} {
  return { lang: locale, dir: dirOf(locale) };
}
