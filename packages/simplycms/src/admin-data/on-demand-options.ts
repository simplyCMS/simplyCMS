import { BTreeIndex } from '@tanstack/react-db';
import {
  queryCollectionOptions,
  type QueryCollectionConfig,
} from '@tanstack/query-db-collection';

/** Конфіг без полів, які ставить сама фабрика. */
type OnDemandConfig<T extends object> = Omit<
  QueryCollectionConfig<T>,
  'syncMode' | 'gcTime' | 'autoIndex' | 'defaultIndexType' | 'schema'
> & {
  /** Індекс сортування для useLiveInfiniteQuery (Е3-16). Дефолт — увімкнено. */
  readonly sortIndex?: boolean;
};

/**
 * ЄДИНА точка, де on-demand колекція отримує `syncMode` та індекс сортування
 * (TSDB-2). УСІ on-demand колекції `admin-data/collections/*` заводяться
 * через цю фабрику — `syncMode` руками в окремому файлі не пишеться
 * (структурний гейт — `__tests__/on-demand-factory-only.test.ts`).
 *
 * `gcTime` фабрика НЕ ставить (обхід `gcTime: 0` знято 2026-10-05): на
 * query-db-collection 1.3.4 запис ревалідує кожен кешований ключ колекції,
 * тож ghost-запис неактивного зрізу не лишається стейл. `gcTime` лишається
 * в `Omit` — колекція не перевизначає його поза фабрикою.
 * Доказ — `__tests__/on-demand-inactive-key.test.tsx`; ціна й ізоляція
 * ключів — TSDB-1 у docs/architecture/upstream-workarounds.md.
 */
export function onDemandCollectionOptions<T extends object>(
  config: OnDemandConfig<T>,
) {
  const { sortIndex = true, ...rest } = config;
  return queryCollectionOptions<T>({
    ...rest,
    syncMode: 'on-demand',
    // UPSTREAM:TSDB-2 — docs/architecture/upstream-workarounds.md
    ...(sortIndex && {
      autoIndex: 'eager' as const,
      defaultIndexType: BTreeIndex,
    }),
  });
}
