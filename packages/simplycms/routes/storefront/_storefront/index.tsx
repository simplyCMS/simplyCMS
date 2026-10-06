import { createFileRoute } from '@tanstack/react-router';
import HomePage from 'simplycms/storefront-routes/pages/Home';
import { getHomePageData } from 'simplycms/storefront-routes/server/home';
import {
  homeHead,
  readStorefrontRoot,
} from 'simplycms/storefront-routes/head/head';
import { buildOrganizationJsonLd } from 'simplycms/storefront-routes/head/organization';

export const Route = createFileRoute('/_storefront/')({
  staleTime: 60_000,
  loader: async () => {
    return getHomePageData();
  },
  // Заголовок головної — `homeTitle` профілю (без суфікса назви), а
  // Organization JSON-LD живе лише тут: це сторінка-представник магазину.
  head: ({ matches }) => {
    const { storeProfile, siteUrl } = readStorefrontRoot(matches);
    return {
      ...homeHead(storeProfile),
      scripts: [buildOrganizationJsonLd(storeProfile, siteUrl)],
    };
  },
  component: Home,
});

function Home() {
  const data = Route.useLoaderData();

  return (
    <HomePage
      banners={data.banners}
      featuredProducts={data.featuredProducts}
      newProducts={data.newProducts}
      sections={data.sections}
      sectionProducts={data.sectionProducts}
    />
  );
}
