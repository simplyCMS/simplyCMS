import { eq, useLiveInfiniteQuery } from '@tanstack/react-db';
import {
  productsCollection,
  sectionsCollection,
  useCollection,
} from 'simplycms/admin-data';
import type { StockStatus } from 'simplycms/contracts';

export const PRODUCTS_PAGE_SIZE = 50;

export interface ProductFilters {
  readonly sectionId?: string;
  readonly isActive?: boolean;
  readonly stockStatus?: StockStatus;
}

/** Рядок списку — проєкція join-а, не повний рядок `Product`. */
export interface ProductListRow {
  readonly id: string;
  readonly name: string;
  readonly images: readonly string[] | null;
  readonly isActive: boolean;
  readonly stockStatus: StockStatus | null;
  readonly sectionName: string | undefined;
}

/**
 * Сторінка списку — on-demand зріз: фільтри йдуть push-down у Drizzle
 * (eq), розділ підтягується join-ом з eager-довідника. «Показати ще» —
 * offset + peek-ahead бібліотеки (Е3-2); загальної кількості свідомо немає.
 * 🔴 Жодного like/ilike/or: push-down їх не несе (Task 0), пошук — П6.
 *
 * 🔴 Step 1: третій аргумент `deps` у `useLiveInfiniteQuery@0.3.6` є (хоч і
 * позначений deprecated на користь виведеної ідентичності запиту) — фільтри
 * йдуть саме ним, а не `key`-перемонтуванням: живий `warnDeprecatedDepsArray`
 * — лише console.warn, поведінка (перезапит при зміні фільтра) робоча.
 */
export function useProductsList(filters: ProductFilters) {
  const products = useCollection(productsCollection);
  const sections = useCollection(sectionsCollection);
  return useLiveInfiniteQuery(
    (q) => {
      let query = q
        .from({ p: products })
        .leftJoin({ s: sections }, ({ p, s }) => eq(p.sectionId, s.id));
      if (filters.sectionId)
        query = query.where(({ p }) => eq(p.sectionId, filters.sectionId!));
      if (filters.isActive !== undefined)
        query = query.where(({ p }) => eq(p.isActive, filters.isActive!));
      if (filters.stockStatus)
        query = query.where(({ p }) => eq(p.stockStatus, filters.stockStatus!));
      // 🔴 БЕЗ явної анотації повернення `select`: `p`/`s` тут — Ref-обгортки
      // DSL запиту (`RefBranch`), не самі значення — анотація `ProductListRow`
      // ламає виведення форми select (TS2322 на кожному полі, спіймано
      // typecheck-гейтом). Бібліотека сама виводить результуючий тип рядка,
      // і він структурно збігається з `ProductListRow` вище.
      return query
        .orderBy(({ p }) => p.createdAt, 'desc')
        .select(({ p, s }) => ({
          id: p.id,
          name: p.name,
          images: p.images,
          isActive: p.isActive,
          stockStatus: p.stockStatus,
          sectionName: s?.name,
        }));
    },
    { pageSize: PRODUCTS_PAGE_SIZE },
    [filters.sectionId, filters.isActive, filters.stockStatus],
  );
}
