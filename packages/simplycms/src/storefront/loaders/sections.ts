import type { StorefrontClient } from '../client';

/** Отримати всі активні секції */
export async function loadSections(client: StorefrontClient) {
  const { data, error } = await client
    .from('sections')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (error) {
    console.error('[loadSections] Помилка:', error.message);
  }

  return data ?? [];
}

/** Отримати секцію за slug */
export async function loadSectionBySlug(
  client: StorefrontClient,
  slug: string,
) {
  const { data, error } = await client
    .from('sections')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[loadSectionBySlug] Помилка:', error.message);
  }

  return data;
}

/** Отримати кореневі секції (без parent_id) для навігації */
export async function loadRootSections(client: StorefrontClient) {
  const { data, error } = await client
    .from('sections')
    .select('id, name, slug')
    .eq('is_active', true)
    .is('parent_id', null)
    .order('sort_order');

  if (error) {
    console.error('[loadRootSections] Помилка:', error.message);
  }

  return data ?? [];
}
