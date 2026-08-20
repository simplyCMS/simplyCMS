import { createFileRoute, notFound } from '@tanstack/react-router';
import PropertyOptionPage from 'simplycms/storefront-routes/pages/PropertyPage';
import { getPropertyOption } from 'simplycms/storefront-routes/server/properties';

export const Route = createFileRoute(
  '/_storefront/properties/$propertySlug/$optionSlug',
)({
  loader: async ({ params: { propertySlug, optionSlug } }) => {
    const result = await getPropertyOption({
      data: { propertySlug, optionSlug },
    });

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
  component: PropertyOption,
});

function PropertyOption() {
  const { property, option, products } = Route.useLoaderData();

  return (
    <PropertyOptionPage
      property={property}
      option={option}
      products={products}
    />
  );
}
