import { createFileRoute } from '@tanstack/react-router';
import ProductDetailPage from 'simplycms/storefront-routes/pages/ProductDetail';
import {
  entityHead,
  entitySearch,
  loadEntityPage,
} from 'simplycms/storefront-routes/pages/entity-route';

// Сторінка сутності за адресою з реєстру: `/<path>` і `/<мова>/<path>` (префікс
// мови знімає `rewrite` роутера). У М1 сутність — товар. Статичні роути
// (`/cart`, `/catalog`, …) специфічніші за splat, тож перекрити їх адреса не може.
export const Route = createFileRoute('/_storefront/$')({
  validateSearch: entitySearch,
  loader: ({ params, location, context }) =>
    loadEntityPage({
      splat: params._splat ?? '',
      publicHref: location.publicHref,
      locales: context.locales,
    }),
  head: ({ loaderData, matches }) => entityHead(matches, loaderData),
  component: EntityPage,
});

function EntityPage() {
  const { product } = Route.useLoaderData();

  return <ProductDetailPage product={product} path={product.page.path} />;
}
