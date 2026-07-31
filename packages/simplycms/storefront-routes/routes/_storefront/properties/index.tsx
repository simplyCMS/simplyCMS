import { createFileRoute } from '@tanstack/react-router';
import { use } from 'react';
import { useTheme } from '@simplycms/themes/ThemeContext';
import { ThemeRegistry } from '@simplycms/themes/ThemeRegistry';
import { getProperties } from '@simplycms/storefront-routes/server/properties';

export const Route = createFileRoute('/_storefront/properties/')({
  staleTime: 60_000,
  loader: async () => {
    const properties = await getProperties();
    return { properties };
  },
  head: () => ({
    meta: [
      { title: 'Характеристики — SimplyCMS Store' },
      {
        name: 'description',
        content: 'Список характеристик товарів',
      },
    ],
  }),
  component: PropertiesPage,
});

function PropertiesPage() {
  const { properties } = Route.useLoaderData();
  const { themeName } = useTheme();
  const theme = use(ThemeRegistry.load(themeName));

  return <theme.pages.PropertiesPage properties={properties} />;
}
