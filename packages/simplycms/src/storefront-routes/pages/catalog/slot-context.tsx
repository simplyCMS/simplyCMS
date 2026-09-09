// Прив'язки slot-компонентів каталогу (контракт тем v3, Фаза 4).

import { createContext, useContext, type ReactNode } from 'react';
import type { CatalogFiltersProps } from '../../views/slots/CatalogFilters';
import type { CatalogProductGridProps } from '../../views/slots/CatalogProductGrid';
import type {
  CatalogFilterChipsProps,
  CatalogLinkChipsProps,
} from '../../views/slots/CatalogSectionChips';
import type {
  CatalogActiveFiltersProps,
  CatalogSortSelectProps,
  CatalogViewModeToggleProps,
} from '../../views/slots/CatalogToolbarSlots';

/**
 * Чипси розділів — один реквізит із двома поведінками: у каталозі вони
 * перемикають вибірку на місці, на сторінці розділу ведуть лінками. Вибір
 * робить контейнер, тема лише ставить слот у свій лейаут.
 */
export type CatalogChipsBinding =
  | ({ mode: 'filter' } & Omit<CatalogFilterChipsProps, 'className'>)
  | ({ mode: 'link' } & Omit<CatalogLinkChipsProps, 'className'>);

/** Усе, що контейнер прибінджує до реквізитів каталогу. */
export interface CatalogBindings {
  chips: CatalogChipsBinding;
  filters: Omit<CatalogFiltersProps, 'className'>;
  sort: Omit<CatalogSortSelectProps, 'className'>;
  viewMode: Omit<CatalogViewModeToggleProps, 'className'>;
  activeFilters: Omit<CatalogActiveFiltersProps, 'className'>;
  grid: Omit<CatalogProductGridProps, 'className'>;
}

const BindingsContext = createContext<CatalogBindings | null>(null);

/**
 * 🔴 Прив'язки їдуть контекстом, а не замиканнями: компоненти слотів мають
 * бути модуль-рівневими й сталими, інакше React перемонтовував би піддерева
 * реквізитів (фільтри з власними запитами, сітку товарів) щорендеру.
 */
export function CatalogSlotBindings({
  value,
  children,
}: {
  value: CatalogBindings;
  children: ReactNode;
}) {
  return (
    <BindingsContext.Provider value={value}>
      {children}
    </BindingsContext.Provider>
  );
}

export function useCatalogBindings(): CatalogBindings {
  const value = useContext(BindingsContext);
  if (!value) {
    throw new Error(
      'Catalog slots must be rendered inside <CatalogSlotBindings>',
    );
  }
  return value;
}
