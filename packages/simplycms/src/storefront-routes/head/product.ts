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
  slug: string;
  description: string | null;
  images: unknown;
};

type OgMeta = { property: string; content: string };

/**
 * `head()` картки товару: заголовок і опис через `storefrontHead`, Open Graph,
 * canonical і Product JSON-LD.
 *
 * Без `siteUrl` (порожній `VITE_SITE_URL`) canonical і `url` у JSON-LD не
 * виводяться: відносний чи вигаданий хост гірший за жоден. `siteUrl` уже
 * нормалізований кореневим лоадером (без кінцевого `/`).
 */
export function productHead(
  matches: ReadonlyArray<HeadMatch>,
  product: ProductHeadInput,
  sectionSlug: string,
): {
  meta: Array<HeadMeta | OgMeta>;
  links: Array<{ rel: string; href: string }>;
  scripts: JsonLdScript[];
} {
  const { siteUrl } = readStorefrontRoot(matches);
  const images: unknown[] = Array.isArray(product.images) ? product.images : [];

  // Опис рахується один раз: той самий текст іде і в meta, і в og:description.
  let description = '';
  const { meta } = storefrontHead(matches, (t) => {
    description =
      product.description ||
      t('product.metaDescription', { name: product.name });
    return { title: product.name, description };
  });

  const canonicalUrl = siteUrl
    ? `${siteUrl}/catalog/${sectionSlug}/${product.slug}`
    : null;

  // Гостьова ціна (F9): без неї `offers` не виводиться зовсім.
  const offers = productOffers(product);

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: images,
    ...(canonicalUrl ? { url: canonicalUrl } : {}),
    ...(offers ? { offers } : {}),
  };

  return {
    meta: [
      ...meta,
      { property: 'og:title', content: product.name },
      { property: 'og:description', content: description },
      ...(typeof images[0] === 'string'
        ? [{ property: 'og:image', content: images[0] }]
        : []),
    ],
    links: canonicalUrl ? [{ rel: 'canonical', href: canonicalUrl }] : [],
    scripts: [serializeJsonLd(jsonLd)],
  };
}
