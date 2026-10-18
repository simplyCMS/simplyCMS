import type { getProduct } from 'simplycms/admin-server';
import type { StockStatus } from 'simplycms/contracts';
import type {
  LocaleStatuses,
  TranslationStatus,
} from '../../translations/translation-context';
import {
  TEXT_FIELDS,
  type DraftTexts,
  type ProductFormValues,
} from './product-form-schema';

/** Відповідь `products.get` — тип виведено з serverFn, серверний код не імпортується. */
export type ProductAggregate = Awaited<ReturnType<typeof getProduct>>;

export const emptyTexts = (): DraftTexts => ({
  name: '',
  shortDescription: '',
  description: '',
  metaTitle: '',
  metaDescription: '',
});

/** Порожня форма нового товару для набору мов. */
export function blankForm(locales: readonly string[]): ProductFormValues {
  return {
    sectionId: '',
    isActive: true,
    isFeatured: false,
    hasModifications: false,
    sku: '',
    stockStatus: 'in_stock',
    path: '',
    texts: Object.fromEntries(locales.map((l) => [l, emptyTexts()])),
    modifications: [],
    propertyValues: [],
    images: [],
  };
}

/**
 * `products.get` → значення форми. `null` полів стає порожнім рядком, мови без
 * рядка перекладу отримують порожні поля (стають «немає перекладу» у статусах).
 */
export function aggregateToForm(
  agg: ProductAggregate,
  locales: readonly string[],
): ProductFormValues {
  const codes = [...new Set([...locales, ...Object.keys(agg.texts)])];
  const texts: Record<string, DraftTexts> = {};
  for (const l of codes) {
    const row = agg.texts[l];
    texts[l] = Object.fromEntries(
      TEXT_FIELDS.map((f) => [f, row?.[f] ?? '']),
    ) as DraftTexts;
  }
  return {
    sectionId: agg.base.sectionId ?? '',
    isActive: agg.base.isActive,
    isFeatured: agg.base.isFeatured,
    hasModifications: agg.base.hasModifications ?? false,
    sku: agg.base.sku ?? '',
    stockStatus: agg.base.stockStatus,
    path: '',
    texts,
    modifications: agg.modifications.map((m) => ({
      id: m.id,
      sku: m.sku ?? '',
      isDefault: m.isDefault,
      sortOrder: m.sortOrder,
      stockStatus: m.stockStatus,
      texts: Object.fromEntries(
        Object.entries(m.texts).map(([l, r]) => [l, r.name ?? '']),
      ),
      token: { ...m.token },
    })),
    propertyValues: agg.propertyValues.map(
      ({ textStatus: _status, ...v }) => v,
    ),
    images: agg.images.map((i) => ({ ...i })),
  };
}

/** Статуси рядків перекладу з `products.get` для вкладок і бейджів полів. */
export function localeStatuses(
  agg: ProductAggregate,
): Record<string, LocaleStatuses> {
  return Object.fromEntries(
    Object.entries(agg.texts).map(([l, r]) => [
      l,
      {
        status: r.status as TranslationStatus,
        fieldStatus: r.fieldStatus as Record<string, TranslationStatus>,
      },
    ]),
  );
}

/** Знімок з новим статусом наявності цілі (`null` — сам товар, інакше модифікація). */
export function withStockStatus(
  f: ProductFormValues,
  modificationId: string | null,
  status: StockStatus,
): ProductFormValues {
  return modificationId === null
    ? { ...f, stockStatus: status }
    : {
        ...f,
        modifications: f.modifications.map((m) =>
          m.id === modificationId ? { ...m, stockStatus: status } : m,
        ),
      };
}
