import { createFileRoute, notFound, redirect } from '@tanstack/react-router';
import ProductDetailPage from 'simplycms/storefront-routes/pages/ProductDetail';
import { getProduct } from 'simplycms/storefront-routes/server/products';
import { productHead } from 'simplycms/storefront-routes/head/product';

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
  // Логіка head() — у `storefront-routes/head/product` (тестується без роуту).
  head: ({ loaderData, matches }) =>
    loaderData
      ? productHead(matches, loaderData.product, loaderData.sectionSlug)
      : {},
  component: ProductDetail,
});

function ProductDetail() {
  const { product, sectionSlug } = Route.useLoaderData();

  return <ProductDetailPage product={product} sectionSlug={sectionSlug} />;
}
