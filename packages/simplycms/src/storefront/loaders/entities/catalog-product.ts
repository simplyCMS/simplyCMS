import { productModifications } from 'simplycms/schema';
import type { PriceEntry } from 'simplycms/contracts';
import type { ProductModification } from 'simplycms/schema/types';
import type { ProductRow } from './product';
import type { SectionRef } from './section';

/** Модифікація у вибірці каталогу: рівно те, чим обираються ціна й наявність. */
export interface CatalogModificationRow {
  id: string;
  stock_status: ProductModification['stockStatus'];
  is_default: boolean;
  sort_order: number;
}

/** Значення характеристики у вибірці — форма предикатів фільтрів каталогу. */
export interface CatalogPropertyValueRow {
  property_id: string;
  value: string | null;
  numeric_value: number | null;
  option_id: string | null;
}

/**
 * Товар вибірки каталогу.
 *
 * 🔴 `isAvailable` рахується на СЕРВЕРІ, а не їде на клієнт разом із залишками
 * по точках видачі. Клієнту потрібен факт «є/немає», а не звідки він узявся;
 * складські рядки в відповіді були б і зайвим трафіком, і публікацією
 * внутрішньої логістики магазину.
 */
export interface CatalogProductRow extends Omit<
  ProductRow,
  'has_modifications'
> {
  /**
   * 🔴 Нормалізовано до boolean: колонка nullable, а вітрина скрізь читала
   * її як `?? true`. Тримати `null` до самого рендера означало б повторити
   * цей же `??` у кожному споживачі — і в одному з них про нього забути.
   */
  has_modifications: boolean;
  section: SectionRef | null;
  /** Повний список — на ньому рахується наявність товару з модифікаціями. */
  product_modifications: CatalogModificationRow[];
  /** Модифікація за замовчуванням (нуль або один елемент) — джерело ціни. */
  modifications: CatalogModificationRow[];
  product_prices: PriceEntry[];
  /** Характеристики товару + характеристики всіх його модифікацій. */
  propertyValues: CatalogPropertyValueRow[];
  isAvailable: boolean;
}

/** Мапа select-а модифікації для вибірки каталогу. */
export const catalogModificationColumns = {
  id: productModifications.id,
  product_id: productModifications.productId,
  stock_status: productModifications.stockStatus,
  is_default: productModifications.isDefault,
  sort_order: productModifications.sortOrder,
};

/** Модифікація за замовчуванням: явний прапорець, інакше найменший `sort_order`. */
export function pickDefaultModification(
  mods: CatalogModificationRow[],
): CatalogModificationRow | null {
  if (mods.length === 0) return null;
  return (
    mods.find((mod) => mod.is_default) ??
    [...mods].sort((a, b) => a.sort_order - b.sort_order)[0]
  );
}

/** `numeric` приїжджає з драйвера рядком — переводимо в число один раз тут. */
export function toNumericValue(value: string | null): number | null {
  return value === null ? null : Number(value);
}
