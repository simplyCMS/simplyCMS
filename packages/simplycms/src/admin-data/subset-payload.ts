import { parseLoadSubsetOptions } from '@tanstack/query-db-collection';
// 🔴 Відхилення від плану (Task 0, Step 3): `LoadSubsetOptions` НЕ
// реекспортується з `@tanstack/query-db-collection` (його index.d.ts
// реекспортує лише іменовані хелпери й типи з `@tanstack/db`, окремо не
// `types.js`) — звірено читанням .d.ts 2026-09-23. Тип бере той самий
// пакет, що й `useLiveInfiniteQuery`/`useLiveQuery`, — `@tanstack/react-db`
// (він `export * from '@tanstack/db'`), тож нової peer-залежності це не
// додає (К3-10′: дві peer-залежності лишаються двома).
import type { LoadSubsetOptions } from '@tanstack/react-db';
// 🔴 type-only: імпорт стирається, серверне дерево в бандл не їде (К3-9′ п.3;
// правило no-server-only-in-client пропускає саме `import type`).
import type { SubsetInput, SubsetPayload } from 'simplycms/admin-server/impl';

// 🔴 isNull — у контракті з Е3: ціни й залишки РІВНЯ ТОВАРУ — це рядки з
// modification_id IS NULL; без оператора їх довелося б довибирати фільтром
// у JS поверх ширшого зрізу. Серверний бік — Task 1 Step 6а.
const SERVER_OPERATORS = new Set([
  'eq',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'isNull',
]);
type ServerFilter = NonNullable<SubsetInput['filters']>[number];

/**
 * Предикат live-query → вхід list-serverFn. ЄДИНЕ місце цього переходу:
 * кожна on-demand колекція кличе саме його, тож контракт «що клієнт уміє
 * попросити» і «що сервер уміє виконати» (`impl/subset.ts`) звіряється тут.
 *
 * 🔴 Дві розбіжності бібліотеки з її ж доками (звірено з src 0.8.6):
 * `parseLoadSubsetOptions` повертає лише `{ filters, sorts, limit }` —
 * `offset` береться з opts напряму, інакше «Показати ще» вічно вантажить
 * першу сторінку; `or`/`like`/`ilike` бібліотека не парсить (throw) —
 * їх тут і немає. `not_*`/`isNull` вона парсить, але сервер їх не має —
 * відмова тут, до мережі, з назвою оператора.
 */
export function toSubsetPayload(
  opts: LoadSubsetOptions | undefined,
): SubsetPayload {
  if (!opts) return {};
  const { filters, sorts, limit } = parseLoadSubsetOptions(opts);
  return {
    subset: {
      filters: filters.map((f): ServerFilter => {
        if (!SERVER_OPERATORS.has(f.operator))
          throw new Error(
            `[admin-data] оператор "${f.operator}" поза контрактом серверного subset (eq/gt/gte/lt/lte/in/isNull)`,
          );
        return {
          field: f.field.map(String),
          operator: f.operator as ServerFilter['operator'],
          // isNull бібліотека віддає без value — на межі це явний null.
          value: f.operator === 'isNull' ? null : f.value,
        };
      }),
      // `nulls` свідомо не передається: сервер сортує дефолтом Postgres
      // (NULLS LAST для asc). Сортувальні колонки каталогу — NOT NULL.
      sorts: sorts.map((s) => ({
        field: s.field.map(String),
        direction: s.direction,
      })),
      ...(limit !== undefined && { limit }),
      ...(opts.offset !== undefined &&
        opts.offset > 0 && { offset: opts.offset }),
    },
  };
}
