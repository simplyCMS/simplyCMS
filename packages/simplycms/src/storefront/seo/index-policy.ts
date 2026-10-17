import {
  buildHreflang,
  localizedPath,
  type HreflangLink,
  type LanguageVersion,
} from './hreflang';

/** Вхід політики індексації сторінки сутності (спека §18.6, майстер І33). */
export type IndexPolicyInput = {
  /** Мова сторінки. */
  locale: string;
  /** Основна мова магазину. */
  primary: string;
  /** SEO-предикат «перекладено» цієї версії (§3.4); для основної — завжди так. */
  isTranslated: boolean;
  /** Ручний `robots` сутності (SEO-поля прийдуть пізніше); `null` — не задано. */
  robots?: string | null;
  /** Ручний canonical на інший URL; `null` — не задано. */
  canonicalOverride?: string | null;
  /** ОПУБЛІКОВАНІ мовні версії сутності (разом з основною). */
  languages: readonly LanguageVersion[];
};

/** Рішення про сторінку: чи індексується, який robots/canonical і які альтернативи. */
export type IndexPolicy = {
  /** Сторінка є самостійною одиницею індексу: потрапляє в sitemap і hreflang. */
  indexable: boolean;
  robots: string;
  /** Шлях від кореня сайту (`/x`, `/en/x`) або абсолютний URL ручного canonical. */
  canonical: string;
  hreflang: HreflangLink[];
};

const INDEX = 'index, follow';
const NOINDEX = 'noindex, follow';

/**
 * ЄДИНА політика індексації сторінки сутності: з її результату формуються
 * `<meta robots>`, canonical, hreflang і sitemap. Правила:
 *  - неперекладена версія — `noindex`, canonical на основну, поза hreflang
 *    (текст на ній основною мовою, тож у індекс її пускати не можна); ручний
 *    `robots` цього НЕ перекриває;
 *  - ручний canonical на інший URL виключає сторінку з hreflang і sitemap;
 *  - інакше — self-canonical і взаємний hreflang із `x-default` на основну.
 *
 * Шляхи без домену: сайт-URL додає викликач (head, sitemap), бо політика має
 * бути чистою функцією від даних сутності й виконуватись на сервері та клієнті.
 */
export function indexPolicy(input: IndexPolicyInput): IndexPolicy {
  const { locale, primary } = input;
  const self = input.languages.find((v) => v.code === locale);
  const main = input.languages.find((v) => v.code === primary);
  const selfPath = self ? localizedPath(locale, primary, self.path) : null;
  const mainPath = main ? localizedPath(primary, primary, main.path) : null;

  if (locale !== primary && !input.isTranslated) {
    return {
      indexable: false,
      robots: NOINDEX,
      canonical: mainPath ?? selfPath ?? '/',
      hreflang: [],
    };
  }

  const robots = input.robots?.trim() || INDEX;
  const noindex = /\bnoindex\b/i.test(robots);
  const canonical = input.canonicalOverride?.trim() || selfPath || '/';
  const foreignCanonical = canonical !== selfPath;
  const indexable = !noindex && !foreignCanonical;

  return {
    indexable,
    robots,
    canonical,
    hreflang: indexable ? buildHreflang(input.languages, primary) : [],
  };
}
