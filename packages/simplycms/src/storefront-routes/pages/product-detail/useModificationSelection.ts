// Вибір модифікації з URL (`?mod=<токен мови>`).

import { useCallback, useMemo } from 'react';
import { useNavigate, useSearch, useLocation } from '@tanstack/react-router';
import type { ProductModificationRow } from './types';

export interface ModificationSelection {
  selectedModId: string;
  selectedMod: ProductModificationRow | undefined;
  onSelect: (modId: string) => void;
}

/**
 * Вибрана модифікація. Джерело правди — URL, а не стан: токен у `?mod=` — це
 * токен ПОТОЧНОЇ мови (історичний нормалізація вже переписала одним 301), а без
 * нього береться дефолтна модифікація. Стану й ефекту немає, тож SSR рендерить
 * ту саму модифікацію, що й клієнт, а адреса товару не обростає `?mod=` сама
 * (канонічна адреса — без query).
 */
export function useModificationSelection(
  modifications: ProductModificationRow[],
  hasModifications: boolean,
): ModificationSelection {
  const navigate = useNavigate();
  const pathname = useLocation({ select: (l) => l.pathname });
  const search = useSearch({ strict: false }) as { mod?: string | number };
  // Роутер JSON-розбирає значення query: токен з самих цифр (`?mod=5`) приходить числом.
  const token = search.mod === undefined ? undefined : String(search.mod);

  const selectedMod = useMemo(() => {
    if (!hasModifications || modifications.length === 0) return undefined;
    const fromUrl = token
      ? modifications.find((m) => m.slug === token)
      : undefined;
    return (
      fromUrl ?? modifications.find((m) => m.is_default) ?? modifications[0]
    );
  }, [modifications, hasModifications, token]);

  const onSelect = useCallback(
    (modId: string) => {
      const mod = modifications.find((m) => m.id === modId);
      if (!mod) return;
      // `replace`: вибір варіанта не засмічує історію браузера; решта query
      // (utm тощо) лишається.
      navigate({
        to: pathname,
        search: (prev: Record<string, unknown>) => ({ ...prev, mod: mod.slug }),
        replace: true,
      });
    },
    [modifications, navigate, pathname],
  );

  return { selectedModId: selectedMod?.id ?? '', selectedMod, onSelect };
}
