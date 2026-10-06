import { createFileRoute, notFound, redirect } from '@tanstack/react-router';
import ProductDetailPage from 'simplycms/storefront-routes/pages/ProductDetail';
import { getProduct } from 'simplycms/storefront-routes/server/products';
import { schemaOrgAvailability } from 'simplycms/domain/inventory';
import {
  readStorefrontRoot,
  storefrontHead,
} from 'simplycms/storefront-routes/head/head';
import { serializeJsonLd } from 'simplycms/storefront-routes/head/organization';

export const Route = createFileRoute(
  '/_storefront/catalog/$sectionSlug/$productSlug',
)({
  validateSearch: (search: Record<string, unknown>): { mod?: string } => ({
    mod: typeof search.mod === 'string' ? search.mod : undefined,
  }),
  loader: async ({ params: { sectionSlug, productSlug } }) => {
    const product = await getProduct({ data: { slug: productSlug } });

    if (!product) {
      throw notFound();
    }

    /** Canonical URL: redirect 301 якщо sectionSlug не відповідає */
    const actualSectionSlug = (product.sections as { slug: string } | null)
      ?.slug;

    if (actualSectionSlug && actualSectionSlug !== sectionSlug) {
      throw redirect({
        to: '/catalog/$sectionSlug/$productSlug',
        params: { sectionSlug: actualSectionSlug, productSlug },
        statusCode: 301,
      });
    }

    return { product, sectionSlug };
  },
  head: ({ loaderData, matches }) => {
    if (!loaderData) return {};

    const { product, sectionSlug } = loaderData;
    const images = Array.isArray(product.images) ? product.images : [];
    const { meta } = storefrontHead(matches, (t) => ({
      title: product.name,
      description:
        product.description ||
        t('product.metaDescription', { name: product.name }),
    }));
    // og:description — той самий текст, що й meta description сторінки.
    const description =
      meta.find(
        (m): m is { name: string; content: string } =>
          'name' in m && m.name === 'description',
      )?.content ?? '';
    // URL сайту — з кореня (серверний env у рантаймі, Е6б-11). Без нього
    // canonical не виводиться: відносний чи вигаданий хост гірший за жоден.
    const { siteUrl } = readStorefrontRoot(matches);
    const canonicalUrl = siteUrl
      ? `${siteUrl}/catalog/${sectionSlug}/${product.slug}`
      : null;

    /** Базова ціна для JSON-LD (перша ціна без модифікації) */
    const basePrice = product.product_prices.find(
      (price) => price.modification_id === null,
    )?.price;

    const jsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: product.description,
      image: images,
      ...(canonicalUrl ? { url: canonicalUrl } : {}),
      offers: {
        '@type': 'Offer',
        priceCurrency: 'UAH',
        ...(basePrice != null ? { price: basePrice } : {}),
        availability: schemaOrgAvailability(product.stock_status),
      },
    };

    return {
      meta: [
        ...meta,
        { property: 'og:title', content: product.name },
        { property: 'og:description', content: description },
        ...(images.length > 0
          ? [{ property: 'og:image', content: images[0] as string }]
          : []),
      ],
      links: canonicalUrl ? [{ rel: 'canonical', href: canonicalUrl }] : [],
      scripts: [serializeJsonLd(jsonLd)],
    };
  },
  component: ProductDetail,
});

function ProductDetail() {
  const { product, sectionSlug } = Route.useLoaderData();

  return <ProductDetailPage product={product} sectionSlug={sectionSlug} />;
}
