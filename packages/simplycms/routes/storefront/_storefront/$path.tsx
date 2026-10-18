import { createFileRoute } from '@tanstack/react-router';
import ProductDetailPage from 'simplycms/storefront-routes/pages/ProductDetail';
import {
  entityHead,
  entitySearch,
  loadEntityPage,
} from 'simplycms/storefront-routes/pages/entity-route';

// Сторінка сутності за адресою з реєстру: `/<path>` і `/<мова>/<path>` (префікс
// мови знімає `rewrite` роутера). У М1 сутність — товар. 🔴 Іменований параметр
// на ОДИН сегмент, а не splat: адреса сутності — один сегмент (§3.2), тож
// `/admin/<щось>`, `/api/…`, `/auth/…` цей роут не перехоплює і поводяться як раніше
// (splat `/$` ловив би їх і тягнув оболонку вітрини). Статичні роути (`/cart`,
// `/catalog`, …) специфічніші, тож перекрити їх адреса не може.
export const Route = createFileRoute('/_storefront/$path')({
  validateSearch: entitySearch,
  loader: ({ params, location, context }) =>
    loadEntityPage({
      path: params.path,
      publicHref: location.publicHref,
      locales: context.locales,
      search: location.search as Record<string, unknown>,
    }),
  head: ({ loaderData, matches }) => entityHead(matches, loaderData),
  component: EntityPage,
});

function EntityPage() {
  const { product } = Route.useLoaderData();

  return <ProductDetailPage product={product} path={product.page.path} />;
}
