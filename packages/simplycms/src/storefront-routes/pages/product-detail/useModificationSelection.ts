// Вибір модифікації із синхронізацією з URL (`?mod=<slug>`).

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearch, useLocation } from '@tanstack/react-router';
import type { ProductModificationRow } from './types';

export interface ModificationSelection {
  selectedModId: string;
  selectedMod: ProductModificationRow | undefined;
  onSelect: (modId: string) => void;
}

/**
 * Стан вибраної модифікації. Джерело правди — URL: після першого рендеру
 * вибір із `?mod=` виграє, інакше береться дефолтна модифікація й URL
 * дописується `replace`-переходом (історія браузера не засмічується).
 */
export function useModificationSelection(
  modifications: ProductModificationRow[],
  hasModifications: boolean,
): ModificationSelection {
  const navigate = useNavigate();
  const pathname = useLocation({ select: (l) => l.pathname });
  const search = useSearch({ strict: false }) as Record<
    string,
    string | undefined
  >;

  const [selectedModId, setSelectedModId] = useState<string>('');
  const modSlugFromUrl = search.mod;

  useEffect(() => {
    if (!hasModifications || modifications.length === 0) return;

    // Визначаємо цільову модифікацію: з URL або за замовчуванням
    let targetMod = modSlugFromUrl
      ? modifications.find((m) => m.slug === modSlugFromUrl)
      : undefined;

    if (!targetMod && !selectedModId) {
      targetMod = modifications.find((m) => m.is_default) || modifications[0];
    }

    if (targetMod && targetMod.id !== selectedModId) {
      const id = targetMod.id;
      const slug = targetMod.slug;
      // Batch: оновлюємо стан та URL разом
      setSelectedModId(id);
      if (slug) {
        navigate({ to: pathname, search: { mod: slug }, replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modifications, modSlugFromUrl, hasModifications]);

  const selectedMod = modifications.find((m) => m.id === selectedModId);

  const onSelect = useCallback(
    (modId: string) => {
      const mod = modifications.find((m) => m.id === modId);
      if (mod) {
        setSelectedModId(modId);
        navigate({ to: pathname, search: { mod: mod.slug }, replace: true });
      }
    },
    [modifications, navigate, pathname],
  );

  return { selectedModId, selectedMod, onSelect };
}
