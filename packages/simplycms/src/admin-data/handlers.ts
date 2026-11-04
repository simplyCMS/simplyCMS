/**
 * Спільні persistence-хендлери колекцій адмінки (дедуплікація Е3): канон
 * write-back замість self-invalidation (К3-7) один раз, а не в кожній
 * колекції. З query-db-collection 1.5 це запис у кеш без мережі і для
 * eager, і для on-demand (ревалідацію M1 знято — TSDB-1), тож поля, які
 * рахує сервер, потрапляють у кеш ЛИШЕ звідси: хендлер `await`-ить
 * write-back рядків, повернених сервером. Гейт `tests/handler-canon.test.ts`
 * сканує УСЮ теку `admin-data` — кожен onInsert/onUpdate/onDelete мусить
 * мати такий write-back на кожному шляху.
 *
 * 🔴 Межа write-back — ВЛАСНА таблиця колекції. Наслідки операції в ІНШИХ
 * таблицях (каскади FK, резерв складу, `SET NULL`) сусідні колекції самі не
 * побачать — і ніколи не бачили: навіть ревалідація qdc 1.3 перезапитувала
 * лише колекцію, в яку писали. Перечитати зачеплені сусідні колекції
 * (`utils.refetch()`) — обовʼязок викликача операції, без нового шару.
 *
 * 🔴 `target` — геттер, не значення: колекція ще не існує в момент, коли
 * її опції збираються, а `() => collection` напряму в об'єктному літералі
 * `queryCollectionOptions` дає TS7022 (self-referential implicit any) —
 * виклик `persistenceHandlers<Row>(...)` обчислюється ЕАГЕРНО як частина
 * того самого літерала, тож TS мусить знати тип `collection` ще ДО того,
 * як він щойно виведений. Кожна колекція заводить типізовану `ref`-комірку
 * (`{ current?: WriteBack<Row> }`, тип не залежить від `collection`) і
 * заповнює її ПІСЛЯ `createCollection` — до першого виклику хендлера
 * (мутація можлива лише після `preload()`/підписки, тобто вже після
 * повернення `create()`).
 *
 * 🔴 Без try/catch-обгортки (Е3-20, закрито): раніше кожен хендлер
 * пропускав кинуте через `normalizeThrown`, бо `@tanstack/db`'s
 * `commit()` (`error instanceof Error ? error : new Error(String(error))`)
 * нібито отримував ПЛОСКИЙ обʼєкт (не `instanceof Error`) і стирав би його
 * поля. Корінь був не в TanStack DB, а в серіалізації Start: без адаптера
 * `ShallowErrorPlugin` (`@tanstack/router-core`) серіалізує лише
 * `.message`, але ВІН ТЕЖ повертає `instanceof Error` — просто голий.
 * `domainErrorAdapter` (`simplycms/runtime/domain-error-adapter`)
 * перехоплює закриту родину (`AdminConflictError`/`AuthzError`) РАНІШЕ за
 * ShallowErrorPlugin і повертає `Error` зі збереженими полями — кинуте вже
 * `instanceof Error` до того, як дійде до `commit()`, тож трансформація
 * не потрібна. Реєстр TSDB-5 (docs/architecture/upstream-workarounds.md)
 * закритий — доказ: `admin/lib/__tests__/conflict-through-transaction.test.ts`.
 */
export interface WriteBack<Row> {
  has(key: string): boolean;
  utils: {
    writeBatch(cb: () => void): Promise<void>;
    writeUpsert(row: Row): Promise<void>;
    writeDelete(key: string): Promise<void>;
  };
}

/** Іменовані фабричні операції сервера — підмножина serverFn з admin-server. */
interface ServerOps<Row> {
  readonly entity: string;
  readonly insert?: (args: { data: never }) => Promise<Row[]>;
  readonly update?: (args: { data: never }) => Promise<Row[]>;
  readonly remove?: (args: { data: never }) => Promise<unknown>;
  /**
   * Кеш поза колекцією (агрегати вітрини), що читає ті самі таблиці: кличеться
   * ПІСЛЯ write-back і ДО повернення з хендлера — інакше збій інвалідації
   * лишив би транзакцію «успішною» з тихо застарілою вітриною.
   */
  readonly afterWrite?: () => Promise<unknown>;
}

interface MutationLike {
  readonly key: unknown;
  readonly modified: unknown;
  readonly changes: unknown;
}
interface HandlerArgs {
  readonly transaction: { readonly mutations: readonly MutationLike[] };
}

/**
 * Складає `onInsert`/`onUpdate`/`onDelete` для `queryCollectionOptions` з
 * фабричних serverFn. Хендлер для операції зʼявляється, лише якщо `ops`
 * її несе — колекція на читання (ціни, залишки) без `insert`/`update`/
 * `remove` не отримує жодного, і `collection.insert()` на ній кидає за
 * побудовою бібліотеки (запис лише іменованою операцією).
 */
export function persistenceHandlers<Row extends { id: string }>(
  target: () => WriteBack<Row>,
  ops: ServerOps<Row>,
) {
  return {
    ...(ops.insert && {
      onInsert: async ({ transaction }: HandlerArgs) => {
        // 🔴 batch: УСІ мутації транзакції, не [0] (дефект старої редакції).
        const drafts = transaction.mutations.map((m) => m.modified as Row);
        const rows = await ops.insert!({ data: drafts as never });
        // 🔴 Fail-loud ДО write-back (урок favorites MetaHub, А-1): інакше в
        // synced-store ляжуть ДВА рядки — серверний під своїм ключем і
        // оптимістичний під клієнтським, що зникне на commit.
        for (const [i, row] of rows.entries())
          if (row.id !== drafts[i]?.id)
            throw new Error(
              `[admin-data] ${ops.entity}: сервер повернув id "${row.id}" замість "${drafts[i]?.id}" — write-back писав би не в той ключ`,
            );
        await target().utils.writeBatch(() => {
          for (const row of rows) target().utils.writeUpsert(row);
        });
        await ops.afterWrite?.();
      },
    }),
    ...(ops.update && {
      onUpdate: async ({ transaction }: HandlerArgs) => {
        const patches = transaction.mutations.map((m) => ({
          id: m.key as string,
          patch: m.changes,
        }));
        const rows = await ops.update!({ data: patches as never });
        await target().utils.writeBatch(() => {
          for (const row of rows) target().utils.writeUpsert(row);
        });
        await ops.afterWrite?.();
      },
    }),
    ...(ops.remove && {
      onDelete: async ({ transaction }: HandlerArgs) => {
        const ids = transaction.mutations.map((m) => ({
          id: m.key as string,
        }));
        await ops.remove!({ data: ids as never });
        await target().utils.writeBatch(() => {
          for (const { id } of ids) target().utils.writeDelete(id);
        });
        await ops.afterWrite?.();
      },
    }),
  };
}
