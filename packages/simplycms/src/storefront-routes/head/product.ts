import { richTextToPlain } from 'simplycms/domain/translations';
import {
  readStorefrontRoot,
  storefrontHead,
  type HeadMatch,
  type HeadMeta,
} from './head';
import { serializeJsonLd, type JsonLdScript } from './organization';
import { productOffers, type ProductOffersInput } from './product-offers';

/**
 * Мінімум товару, потрібний `head()` картки. Структурний тип, а не тип
 * лоадера: тека `head` клієнт-безпечна й не тягне `storefront/loaders`.
 */
export type ProductHeadInput = ProductOffersInput & {
  name: string;
  short_description?: string | null;
  description: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  images: unknown;
  /** Мовний контекст сторінки: мова й рішення політики індексації (М1, І33). */
  page: {
    locale: string;
    seo: {
      robots: string;
      canonical: string;
      hreflang: ReadonlyArray<{ hrefLang: string; href: string }>;
    };
  };
};

type OgMeta = { property: string; content: string };
type HeadLink = { rel: string; href: string; hrefLang?: string };

/** Абсолютний URL: уже повний (ручний canonical) лишається, шлях дістає `siteUrl`. */
const absolute = (siteUrl: string, href: string): string =>
  /^https?:\/\//i.test(href) ? href : `${siteUrl}${href}`;

/** `og:locale` — `мова_РЕГІОН` (`pt-BR` → `pt_BR`); голий код лишається як є. */
const ogLocale = (locale: string): string => locale.replace('-', '_');

/**
 * `head()` картки товару: заголовок і опис через `storefrontHead`, Open Graph,
 * canonical, hreflang, robots і Product JSON-LD.
 *
 * Усе, що залежить від мови, приходить готовим із сервера (`page.seo` — результат
 * `indexPolicy`): неперекладена версія має `noindex` і canonical на основну, без
 * hreflang. Заголовок бере `meta_title` (інакше назву), опис — `meta_description`,
 * далі короткий опис, далі текст опису БЕЗ HTML-тегів (спека §7.4).
 *
 * Без `siteUrl` (порожній `VITE_SITE_URL`) canonical, hreflang і `url` у JSON-LD
 * не виводяться: відносний чи вигаданий хост гірший за жоден. `siteUrl` уже
 * нормалізований кореневим лоадером (без кінцевого `/`).
 */
export function productHead(
  matches: ReadonlyArray<HeadMatch>,
  product: ProductHeadInput,
): {
  meta: Array<HeadMeta | OgMeta>;
  links: HeadLink[];
  scripts: JsonLdScript[];
} {
  const { siteUrl } = readStorefrontRoot(matches);
  const { page } = product;
  const images: unknown[] = Array.isArray(product.images) ? product.images : [];
  const title = product.meta_title || product.name;

  // Опис рахується один раз: той самий текст іде в meta, og:description і JSON-LD.
  const plainDescription = product.description
    ? richTextToPlain(product.description)
    : '';
  let description = '';
  const { meta } = storefrontHead(matches, (t) => {
    description =
      product.meta_description ||
      product.short_description ||
      plainDescription ||
      t('product.metaDescription', { name: product.name });
    return { title, description };
  });

  const canonicalUrl = siteUrl ? absolute(siteUrl, page.seo.canonical) : null;

  // Гостьова ціна (F9): без неї `offers` не виводиться зовсім.
  const offers = productOffers(product);

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: plainDescription || description,
    image: images,
    inLanguage: page.locale,
    ...(canonicalUrl ? { url: canonicalUrl } : {}),
    ...(offers ? { offers } : {}),
  };

  return {
    meta: [
      ...meta,
      { name: 'robots', content: page.seo.robots },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:locale', content: ogLocale(page.locale) },
      ...(typeof images[0] === 'string'
        ? [{ property: 'og:image', content: images[0] }]
        : []),
    ],
    links: [
      ...(canonicalUrl ? [{ rel: 'canonical', href: canonicalUrl }] : []),
      ...(siteUrl
        ? page.seo.hreflang.map((h) => ({
            rel: 'alternate',
            hrefLang: h.hrefLang,
            href: absolute(siteUrl, h.href),
          }))
        : []),
    ],
    scripts: [serializeJsonLd(jsonLd)],
  };
}
