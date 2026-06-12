import { createFileRoute } from '@tanstack/react-router';
import { use } from 'react';
import { useTheme } from '@simplysoftua/themes/ThemeContext';
import { ThemeRegistry } from '@simplysoftua/themes/ThemeRegistry';
import { getHomePageData } from '../../server/home';

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
  component: HomePage,
});

function HomePage() {
  const data = Route.useLoaderData();
  const { themeName } = useTheme();
  const theme = use(ThemeRegistry.load(themeName));

  return (
    <theme.pages.HomePage
      banners={data.banners}
      featuredProducts={data.featuredProducts}
      newProducts={data.newProducts}
      sections={data.sections}
    />
  );
}
