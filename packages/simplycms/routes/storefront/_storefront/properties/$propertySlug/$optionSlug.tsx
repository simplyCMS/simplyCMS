import { createFileRoute, notFound } from '@tanstack/react-router';
import PropertyOptionPage from 'simplycms/storefront-routes/pages/PropertyPage';
import { getPropertyOption } from 'simplycms/storefront-routes/server/properties';
import { storefrontHead } from 'simplycms/storefront-routes/head/head';

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
  head: ({ loaderData, matches }) =>
    storefrontHead(matches, () => ({
      title: loaderData
        ? `${loaderData.option.name} — ${loaderData.property.name}`
        : undefined,
    })),
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
