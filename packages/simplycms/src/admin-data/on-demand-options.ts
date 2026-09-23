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
 * ЄДИНА точка, де on-demand колекція отримує `syncMode` і `gcTime` (Е3-17).
 * УСІ on-demand колекції `admin-data/collections/*` заводяться через цю
 * фабрику — `syncMode`/`gcTime` руками в окремому файлі більше не пишуться
 * (структурний гейт — `__tests__/on-demand-factory-only.test.ts`).
 *
 * 🔴 Чому `gcTime: 0` (виміряно на @tanstack/query-db-collection 1.2.11,
 * UPSTREAM:TSDB-1 — docs/architecture/upstream-workarounds.md): будь-який
 * write (`writeUpsert`/`writeDelete`) перезаписує кеш КОЖНОГО ключа з тим
 * самим префіксом, і активного, і вже неактивного «примарного» (ghost) —
 * без `gcTime: 0` неактивний зріз лишається в кеші React Query до 5 хв і на
 * ремаунті підхоплює цей зіпсований кеш замість свіжого фетчу. `gcTime: 0`
 * прибирає ghost-запис одразу після розмонтування.
 */
export function onDemandCollectionOptions<T extends object>(
  config: OnDemandConfig<T>,
) {
  const { sortIndex = true, ...rest } = config;
  return queryCollectionOptions<T>({
    ...rest,
    syncMode: 'on-demand',
    gcTime: 0,
    // UPSTREAM:TSDB-2 — docs/architecture/upstream-workarounds.md
    ...(sortIndex && {
      autoIndex: 'eager' as const,
      defaultIndexType: BTreeIndex,
    }),
  });
}
