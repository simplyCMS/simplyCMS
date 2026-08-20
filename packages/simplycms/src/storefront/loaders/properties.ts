import type { StorefrontClient } from '../client';

/** Отримати всі характеристики з has_page=true */
export async function loadProperties(client: StorefrontClient) {
  const { data, error } = await client
    .from('section_properties')
    .select('*, property_options(*)')
    .eq('has_page', true)
    .order('name');

  if (error) {
    console.error('[loadProperties] Помилка:', error.message);
  }

  return data ?? [];
}

/** Отримати характеристику за slug з опціями */
export async function loadPropertyBySlug(
  client: StorefrontClient,
  slug: string,
) {
  const { data, error } = await client
    .from('section_properties')
    .select('*, property_options(*)')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    console.error('[loadPropertyBySlug] Помилка:', error.message);
  }

  return data;
}

/** Отримати опцію характеристики з повʼязаними товарами */
export async function loadPropertyOption(
  client: StorefrontClient,
  propertySlug: string,
  optionSlug: string,
) {
  const { data: property } = await client
    .from('section_properties')
    .select('*')
    .eq('slug', propertySlug)
    .maybeSingle();

  if (!property) return null;

  const { data: option } = await client
    .from('property_options')
    .select('*')
    .eq('property_id', property.id)
    .eq('slug', optionSlug)
    .maybeSingle();

  if (!option) return null;

  const { data: products } = await client
    .from('products')
    // Один рядковий літерал, а не конкатенація: PostgREST виводить типи рядків
    // із ЛІТЕРАЛЬНОГО типу select-а, а `"a" + "b"` TypeScript звужує до `string`,
    // через що результат ставав `GenericStringError[]`.
    .select(
      '*, product_modifications!inner(*, modification_property_values!inner(option_id))',
    )
    .eq(
      'product_modifications.modification_property_values.option_id',
      option.id,
    )
    .eq('is_active', true);

  return { property, option, products: products ?? [] };
}
