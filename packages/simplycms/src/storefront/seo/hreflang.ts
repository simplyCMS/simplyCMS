import { localizedPath } from 'simplycms/domain';

/**
 * Мовні версії сутності й адреси за ними (майстер §3.2, §3.4, І33/І37).
 * Чиста логіка без БД: нею користуються `indexPolicy`, sitemap і head.
 */

/** Одна мовна версія сутності: код мови, SEO-предикат «перекладено» і її адреса. */
export type LanguageVersion = {
  readonly code: string;
  readonly isTranslated: boolean;
  /** Поточна адреса сутності в цій мові, без префікса мови й без початкового `/`. */
  readonly path: string;
};

/** Пара атрибутів `<link rel="alternate" hreflang href>`. */
export type HreflangLink = { hrefLang: string; href: string };

/** `x-default` — службове значення hreflang для сторінки «мова не визначена». */
export const X_DEFAULT = 'x-default';

// Складач шляху мови — один на домен (`simplycms/domain`), тут лише реекспорт для SEO.
export { localizedPath };

/**
 * hreflang сторінки: ЛИШЕ перекладені версії (основна — завжди), взаємно, плюс
 * `x-default` на основну (І33, І37). Версія без перекладу сюди не потрапляє:
 * вона `noindex` і вказує canonical на основну. Єдина версія — це не альтернативи,
 * тож для одномовного магазину розмітка hreflang не виводиться.
 */
export function buildHreflang(
  versions: readonly LanguageVersion[],
  primary: string,
): HreflangLink[] {
  const alternates = versions.filter(
    (v) => v.code === primary || v.isTranslated,
  );
  const main = alternates.find((v) => v.code === primary);
  if (!main || alternates.length < 2) return [];
  return [
    ...alternates.map((v) => ({
      hrefLang: v.code,
      href: localizedPath(v.code, primary, v.path),
    })),
    { hrefLang: X_DEFAULT, href: localizedPath(primary, primary, main.path) },
  ];
}
