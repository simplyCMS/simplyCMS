// Доменні об'єкти каталогу (товари, розділи, характеристики).
// Незалежні від рядків БД — host-репозиторій мапить свою схему на ці типи.

import type { PageQuery } from "./common";
import type { PriceEntry } from "./pricing";
import type { StockStatus } from "./inventory";

export interface ProductModification {
  id: string;
  sku: string | null;
  stock_status: StockStatus | null;
  is_default: boolean;
  sort_order: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  section_id: string | null;
  stock_status: StockStatus | null;
  has_modifications: boolean;
  modifications: ProductModification[];
  prices: PriceEntry[];
  images: string[];
  /** Обчислюється inventory-доменом, опційно. */
  isAvailable?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Section {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface PropertyOption {
  id: string;
  property_id: string;
  value: string;
  sort_order: number;
}

export interface Property {
  id: string;
  code: string;
  name: string;
  type: string;
  is_filterable: boolean;
  sort_order: number;
  options?: PropertyOption[];
}

export interface ProductQuery extends PageQuery {
  sectionId?: string;
  search?: string;
  /** property code -> обрані значення (faceted navigation). */
  filters?: Record<string, string[]>;
  inStockOnly?: boolean;
}

export interface SectionQuery extends PageQuery {
  parentId?: string | null;
  activeOnly?: boolean;
}

export interface PropertyQuery extends PageQuery {
  sectionId?: string;
  filterableOnly?: boolean;
}
