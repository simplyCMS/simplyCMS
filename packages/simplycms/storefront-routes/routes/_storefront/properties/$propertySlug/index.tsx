import { createFileRoute, notFound } from '@tanstack/react-router';
import PropertyDetailPage from '@simplycms/storefront-routes/pages/PropertyDetail';
import { getPropertyBySlug } from '@simplycms/storefront-routes/server/properties';

export const Route = createFileRoute('/_storefront/properties/$propertySlug/')({
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
  component: PropertyDetail,
});

function PropertyDetail() {
  const { property, options } = Route.useLoaderData();

  return <PropertyDetailPage property={property} options={options} />;
}
