import { createFileRoute, notFound } from '@tanstack/react-router';
import { use } from 'react';
import { useTheme } from '@simplycms/themes/ThemeContext';
import { ThemeRegistry } from '@simplycms/themes/ThemeRegistry';
import { getPropertyBySlug } from '../../../../server/properties';

export const Route = createFileRoute(
  '/_storefront/properties/$propertySlug/',
)({
  loader: async ({ params: { propertySlug } }) => {
    const property = await getPropertyBySlug({ data: { slug: propertySlug } });

    if (!property) {
      throw notFound();
    }

    return {
      property,
      options: property.property_options ?? [],
    };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: `${loaderData?.property?.name ?? 'Характеристика'} — SimplyCMS Store`,
      },
    ],
  }),
  component: PropertyDetailPage,
});

function PropertyDetailPage() {
  const { property, options } = Route.useLoaderData();
  const { themeName } = useTheme();
  const theme = use(ThemeRegistry.load(themeName));

  return (
    <theme.pages.PropertyDetailPage
      property={property}
      options={options}
    />
  );
}
