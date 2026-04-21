import { createFileRoute, notFound } from '@tanstack/react-router';
import { use } from 'react';
import { useTheme } from '@simplycms/themes/ThemeContext';
import { ThemeRegistry } from '@simplycms/themes/ThemeRegistry';
import { getPropertyOption } from '../../../../server/properties';

export const Route = createFileRoute(
  '/_storefront/properties/$propertySlug/$optionSlug',
)({
  loader: async ({ params: { propertySlug, optionSlug } }) => {
    const result = await getPropertyOption({ data: { propertySlug, optionSlug } });

    if (!result) {
      throw notFound();
    }

    return {
      property: result.property,
      option: result.option,
      products: result.products,
    };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.option.name} — ${loaderData.property.name} — SimplyCMS Store`
          : 'SimplyCMS Store',
      },
    ],
  }),
  component: PropertyOptionPage,
});

function PropertyOptionPage() {
  const { property, option, products } = Route.useLoaderData();
  const { themeName } = useTheme();
  const theme = use(ThemeRegistry.load(themeName));

  return (
    <theme.pages.PropertyOptionPage
      property={property}
      option={option}
      products={products}
    />
  );
}
