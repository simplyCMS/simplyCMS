// View-model каталогу та сторінки розділу (контракт тем v3).
// Обидві сторінки мають однаковий кістяк, тому `CatalogSectionViewModel`
// розширює `CatalogViewModel` розділом — спільні підкомпоненти view не
// дублюються.

import type { BreadcrumbItem } from './common';
import type { SlotComponent } from './slots';

export interface CatalogSlots {
  /** Чипси розділів (перемикання вибірки / лінки на розділи). */
  SectionChips: SlotComponent;
  /** Панель фільтрів; ядро рендерить її і в сайдбарі, і в мобільній шторці. */
  Filters: SlotComponent;
  /** Селект сортування. */
  SortSelect: SlotComponent;
  /** Перемикач «сітка / список». */
  ViewModeToggle: SlotComponent;
  /** Бейджі активних фільтрів зі скиданням. */
  ActiveFilters: SlotComponent;
  /** Сітка товарів: SSR-список, стани завантаження й порожньої вибірки. */
  ProductGrid: SlotComponent;
}

export interface CatalogViewModel {
  breadcrumbs: BreadcrumbItem[];
  /** Кількість товарів у поточній вибірці — підпис панелі інструментів. */
  productCount: number;
  slots: CatalogSlots;
}

/** Розділ каталогу як сторінка. */
export interface CatalogSectionInfo {
  id: string;
  name: string;
  slug: string;
  /** HTML-опис розділу під списком товарів; null — блок не рендериться. */
  description: string | null;
}

export interface CatalogSectionViewModel extends CatalogViewModel {
  section: CatalogSectionInfo;
}
