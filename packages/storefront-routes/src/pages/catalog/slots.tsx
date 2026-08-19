// Слоти каталогу, прибінджені до контейнера (контракт тем v3, Фаза 4).
//
// Набір ОДИН на дві сторінки: каталог і розділ розходяться лише даними
// прив'язок, тож тема, яка перевизначила `Catalog`, отримує ті самі реквізити,
// що й на `CatalogSection`.

import type {
  CatalogSlots,
  SlotAppearanceProps,
} from '@simplycms/objects/views';
import { CatalogFilters } from '../../views/slots/CatalogFilters';
import { CatalogProductGrid } from '../../views/slots/CatalogProductGrid';
import {
  CatalogFilterChips,
  CatalogLinkChips,
} from '../../views/slots/CatalogSectionChips';
import {
  CatalogActiveFilters,
  CatalogSortSelect,
  CatalogViewModeToggle,
} from '../../views/slots/CatalogToolbarSlots';
import { useCatalogBindings } from './slot-context';

function SectionChips({ className }: SlotAppearanceProps) {
  const { chips } = useCatalogBindings();

  if (chips.mode === 'link') {
    return (
      <CatalogLinkChips
        className={className}
        sections={chips.sections}
        activeId={chips.activeId}
      />
    );
  }

  return (
    <CatalogFilterChips
      className={className}
      sections={chips.sections}
      selectedId={chips.selectedId}
      onSelect={chips.onSelect}
    />
  );
}

function Filters({ className }: SlotAppearanceProps) {
  const { filters } = useCatalogBindings();
  return <CatalogFilters className={className} {...filters} />;
}

function SortSelect({ className }: SlotAppearanceProps) {
  const { sort } = useCatalogBindings();
  return <CatalogSortSelect className={className} {...sort} />;
}

function ViewModeToggle({ className }: SlotAppearanceProps) {
  const { viewMode } = useCatalogBindings();
  return <CatalogViewModeToggle className={className} {...viewMode} />;
}

function ActiveFilters({ className }: SlotAppearanceProps) {
  const { activeFilters } = useCatalogBindings();
  return <CatalogActiveFilters className={className} {...activeFilters} />;
}

function ProductGrid({ className }: SlotAppearanceProps) {
  const { grid } = useCatalogBindings();
  return <CatalogProductGrid className={className} {...grid} />;
}

/** Сталий набір реквізитів каталогу — саме він їде у view-model. */
export const catalogSlots: CatalogSlots = {
  SectionChips,
  Filters,
  SortSelect,
  ViewModeToggle,
  ActiveFilters,
  ProductGrid,
};
