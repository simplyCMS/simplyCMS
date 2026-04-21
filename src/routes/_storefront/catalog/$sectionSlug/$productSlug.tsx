import { createFileRoute, notFound, redirect } from '@tanstack/react-router';
import { use } from 'react';
import { useTheme } from '@simplycms/themes/ThemeContext';
import { ThemeRegistry } from '@simplycms/themes/ThemeRegistry';
import { getProduct } from '../../../../server/products';

const BASE_URL =
  import.meta.env.VITE_SITE_URL || 'https://example.com';

export const Route = createFileRoute(
  '/_storefront/catalog/$sectionSlug/$productSlug',
)({
  loader: async ({ params: { sectionSlug, productSlug } }) => {
    const product = await getProduct({ data: { slug: productSlug } });

    if (!product) {
      throw notFound();
    }

    /** Canonical URL: redirect 301 якщо sectionSlug не відповідає */
    const actualSectionSlug =
      (product.sections as { slug: string } | null)?.slug;

    if (actualSectionSlug && actualSectionSlug !== sectionSlug) {
      throw redirect({
        to: '/catalog/$sectionSlug/$productSlug',
        params: { sectionSlug: actualSectionSlug, productSlug },
        statusCode: 301,
      });
    }

    return { product, sectionSlug };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};

    const { product, sectionSlug } = loaderData;
    const images = Array.isArray(product.images) ? product.images : [];
    const description =
      product.description || `Купити ${product.name} в SimplyCMS Store`;
    const canonicalUrl =
      `${BASE_URL}/catalog/${sectionSlug}/${product.slug}`;

    /** Базова ціна для JSON-LD (перша ціна без модифікації) */
    const prices = Array.isArray(product.product_prices)
      ? product.product_prices
      : [];
    const basePrice = prices.find(
      (p: Record<string, unknown>) => !p.modification_id,
    )?.price as number | undefined;

    const jsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: product.description,
      image: images,
      url: canonicalUrl,
      offers: {
        '@type': 'Offer',
        priceCurrency: 'UAH',
        ...(basePrice != null ? { price: basePrice } : {}),
        availability:
          product.stock_status === 'in_stock'
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
      },
    };

    return {
      meta: [
        { title: `${product.name} — SimplyCMS Store` },
        { name: 'description', content: description },
        { property: 'og:title', content: product.name },
        { property: 'og:description', content: description },
        ...(images.length > 0
          ? [{ property: 'og:image', content: images[0] as string }]
          : []),
      ],
      links: [{ rel: 'canonical', href: canonicalUrl }],
      scripts: [
        {
          type: 'application/ld+json',
          children: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        },
      ],
    };
  },
  component: ProductPage,
});

function ProductPage() {
  const { product, sectionSlug } = Route.useLoaderData();
  const { themeName } = useTheme();
  const theme = use(ThemeRegistry.load(themeName));

  return (
    <theme.pages.ProductPage
      product={product}
      sectionSlug={sectionSlug}
    />
  );
}
