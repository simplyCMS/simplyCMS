import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { createServerSupabase } from './supabase';

/** Отримати всі характеристики з has_page=true */
export const getProperties = createServerFn({ method: 'GET' })
  .handler(async () => {
    const supabase = createServerSupabase();

    const { data, error } = await supabase
      .from('section_properties')
      .select('*, property_options(*)')
      .eq('has_page', true)
      .order('name');

    if (error) {
      console.error('[getProperties] Помилка:', error.message);
    }

    return data ?? [];
  });

/** Отримати характеристику за slug з опціями */
export const getPropertyBySlug = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data: { slug } }) => {
    const supabase = createServerSupabase();

    const { data, error } = await supabase
      .from('section_properties')
      .select('*, property_options(*)')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      console.error('[getPropertyBySlug] Помилка:', error.message);
    }

    return data;
  });

/** Отримати опцію характеристики з повʼязаними товарами */
export const getPropertyOption = createServerFn({ method: 'GET' })
  .inputValidator(z.object({
    propertySlug: z.string().min(1),
    optionSlug: z.string().min(1),
  }))
  .handler(async ({ data: { propertySlug, optionSlug } }) => {
    const supabase = createServerSupabase();

    const { data: property } = await supabase
      .from('section_properties')
      .select('*')
      .eq('slug', propertySlug)
      .maybeSingle();

    if (!property) return null;

    const { data: option } = await supabase
      .from('property_options')
      .select('*')
      .eq('property_id', property.id)
      .eq('slug', optionSlug)
      .maybeSingle();

    if (!option) return null;

    const { data: products } = await supabase
      .from('products')
      .select(
        '*, product_modifications!inner(' +
        '*, modification_property_values!inner(option_id)' +
        ')',
      )
      .eq(
        'product_modifications.modification_property_values.option_id',
        option.id,
      )
      .eq('is_active', true);

    return { property, option, products: products ?? [] };
  });
