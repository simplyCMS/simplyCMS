import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { createServerSupabase } from './supabase';

/** Повний select для сторінки товару (з усіма зв'язками) */
const PRODUCT_FULL_SELECT = `
  *,
  sections(id, slug, name),
  product_modifications(*),
  product_prices(price_type_id, price, old_price, modification_id),
  product_property_values(
    property_id,
    value,
    numeric_value,
    option_id,
    property_options:option_id(id, slug),
    section_properties:property_id(id, name, slug, property_type, has_page)
  )
` as const;

/** Отримати товар за slug (для сторінки товару) */
export const getProduct = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data: input }) => {
    const { slug } = input as { slug: string };
    const supabase = createServerSupabase();

    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_FULL_SELECT)
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      console.error('[getProduct] Помилка:', error.message);
    }

    return data;
  });

/** Отримати всі активні товари (каталог) */
export const getProducts = createServerFn({ method: 'GET' })
  .handler(async () => {
    const supabase = createServerSupabase();

    const { data, error } = await supabase
      .from('products')
      .select('*, sections(*), product_modifications(*)')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[getProducts] Помилка:', error.message);
    }

    return data ?? [];
  });

/** Отримати товари за ID секції */
export const getProductsBySectionId = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ sectionId: z.string().min(1) }))
  .handler(async ({ data: input }) => {
    const { sectionId } = input as { sectionId: string };
    const supabase = createServerSupabase();

    const { data, error } = await supabase
      .from('products')
      .select('*, product_modifications(*)')
      .eq('section_id', sectionId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[getProductsBySectionId] Помилка:', error.message);
    }

    return data ?? [];
  });
