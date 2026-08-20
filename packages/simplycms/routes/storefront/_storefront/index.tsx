import { createFileRoute } from '@tanstack/react-router';
import HomePage from 'simplycms/storefront-routes/pages/Home';
import { getHomePageData } from 'simplycms/storefront-routes/server/home';

export const Route = createFileRoute('/_storefront/')({
  staleTime: 60_000,
  loader: async () => {
    return getHomePageData();
  },
  head: () => ({
    meta: [
      { title: 'Головна — SimplyCMS Store' },
      {
        name: 'description',
        content: 'SimplyCMS Store — інтернет-магазин',
      },
    ],
  }),
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
