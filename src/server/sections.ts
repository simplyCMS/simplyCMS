import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { createServerSupabase } from './supabase';

/** Отримати всі активні секції */
export const getSections = createServerFn({ method: 'GET' })
  .handler(async () => {
    const supabase = createServerSupabase();

    const { data, error } = await supabase
      .from('sections')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (error) {
      console.error('[getSections] Помилка:', error.message);
    }

    return data ?? [];
  });

/** Отримати секцію за slug */
export const getSectionBySlug = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data: { slug } }) => {
    const supabase = createServerSupabase();

    const { data, error } = await supabase
      .from('sections')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      console.error('[getSectionBySlug] Помилка:', error.message);
    }

    return data;
  });

/** Отримати кореневі секції (без parent_id) для навігації */
export const getRootSections = createServerFn({ method: 'GET' })
  .handler(async () => {
    const supabase = createServerSupabase();

    const { data, error } = await supabase
      .from('sections')
      .select('id, name, slug')
      .eq('is_active', true)
      .is('parent_id', null)
      .order('sort_order');

    if (error) {
      console.error('[getRootSections] Помилка:', error.message);
    }

    return data ?? [];
  });
