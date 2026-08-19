// Довідкові запити каталогу: розділи, числові характеристики, опції
// характеристик (контракт тем v3, Фаза 4).

import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from '@simplycms/supabase/SupabaseProvider';
import type { Tables } from '@simplycms/supabase';
import type { NumericProperty } from './types';

/** Рядок розділу у формі, яку віддає SSR-лоадер і споживають чипси. */
export type CatalogSectionRow = Tables<'sections'> & Record<string, unknown>;

/** Усі активні розділи — чипси над списком товарів. */
export function useSectionsQuery(initialSections?: CatalogSectionRow[]) {
  const supabase = useSupabaseClient();

  return useQuery({
    queryKey: ['public-sections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sections')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data;
    },
    initialData: initialSections,
  });
}

/** Розділ поточної сторінки за slug-ом. */
export function useSectionQuery(
  sectionSlug: string | undefined,
  initialSection?: CatalogSectionRow,
) {
  const supabase = useSupabaseClient();

  return useQuery({
    queryKey: ['public-section', sectionSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sections')
        .select('*')
        .eq('slug', sectionSlug!)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    initialData: initialSection,
  });
}

/** Числові характеристики розділу, за якими можна фільтрувати. */
export function useNumericPropertiesQuery(sectionId: string | null) {
  const supabase = useSupabaseClient();

  return useQuery({
    queryKey: ['section-numeric-properties', sectionId],
    queryFn: async (): Promise<NumericProperty[]> => {
      if (!sectionId) return [];
      const { data, error } = await supabase
        .from('section_property_assignments')
        .select('property:property_id (id, slug, property_type, is_filterable)')
        .eq('section_id', sectionId);
      if (error) throw error;
      return data
        .map((a) => a.property as NumericProperty | null)
        .filter((p): p is NumericProperty =>
          Boolean(
            p &&
            p.is_filterable &&
            (p.property_type === 'number' || p.property_type === 'range'),
          ),
        );
    },
    enabled: !!sectionId,
  });
}

/**
 * Опції характеристик — назви для бейджів активних фільтрів.
 *
 * 🔴 Ключ без розділу навмисно: запит вибирає опції ЦІЛКОМ і розділу не
 * знає, тож розділ у ключі давав би зайвий рефетч тих самих даних на кожне
 * перемикання чипсів (так було до спліту, окремими ключами на двох сторінках).
 */
export function usePropertyOptionsQuery() {
  const supabase = useSupabaseClient();

  return useQuery({
    queryKey: ['all-property-options-for-filters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_options')
        .select('id, name, property_id, section_properties(name, slug)');
      if (error) throw error;
      return data;
    },
  });
}
