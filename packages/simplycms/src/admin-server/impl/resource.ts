import type { Table } from 'drizzle-orm';
import type { z } from 'zod';
import type { RequestGrant } from 'simplycms/auth';
import type { ActorDb } from 'simplycms/db';
import { subsetInputSchema, type SubsetPayload } from './subset';
import { buildResourceSchemas, type ColumnName } from './resource-schemas';
import type {
  AdminResourceColumnGuards,
  AdminResourceConfigBase,
} from './resource-config';
import { assertMaxLimit, pickColumns } from './resource-projection';
import { listResourceRows, type ResourceListContext } from './resource-list';
import {
  insertResourceRows,
  removeResourceRows,
  updateResourceRows,
  type ResourceWriteContext,
} from './resource-write';
import { runAdmin } from './run';

// Споживачі (`impl/orders/change-status.ts`, тести) імпортують звідси.
export { pickColumns };

/**
 * Фабрика ОПЕРАЦІЙ і схем ресурсу адмінки (К3-4′). serverFn НЕ створює:
 * компілятор Start вимагає топ-рівневих const (а fast-path нетоплевел
 * виклик мовчки пропускає) — обгортки пише Task-модуль сутності явно.
 *
 * 🔴 Розріз «фабрика vs іменована операція» — ПО ОПЕРАЦІЯХ: усе з
 * доменним інваріантом (setDefault, reorder, remove-з-перевіркою)
 * пишеться руками в impl/<entity>/. DSL запитів немає — складніше за
 * subset = useLiveQuery на клієнті або іменована операція.
 *
 * 🔴 Exhaustiveness і заборона перетину списків колонок — типом
 * `AdminResourceColumnGuards` (`resource-config.ts`).
 */
export function defineAdminResource<
  T extends Table,
  const W extends ColumnName<T>,
  const R extends ColumnName<T>,
  const I extends ColumnName<T> = never,
  const O extends ColumnName<T> = never,
>(
  config: AdminResourceConfigBase<T, W, R, I, O> &
    AdminResourceColumnGuards<T, W, R, I, O>,
) {
  const { rowSchema, insertSchema, updateSchema, removeSchema } =
    buildResourceSchemas(
      config.table,
      config.writable,
      config.refine,
      config.insertOnly,
      config.omit,
    );
  // Е5-7: явна проєкція для SELECT і RETURNING (без omit — усі колонки,
  // тобто той самий набір, що `select()`/`returning()` без аргументу).
  const picked = pickColumns(config.table, config.omit ?? []);
  /** Тип рядка, що бачить споживач: без прихованих колонок. */
  type Row = Omit<T['$inferSelect'], O>;
  const { maxLimit } = config;
  assertMaxLimit(config.entity, maxLimit);
  // Спільний контекст читання (`resource-list.ts`) і запису (`resource-write.ts`).
  const ctx: ResourceListContext & ResourceWriteContext = {
    entity: config.entity,
    table: config.table,
    allow: { filterable: config.filterable, sortable: config.sortable },
    defaultOrder: config.defaultOrder,
    maxLimit,
    picked,
    touch: config.touch,
  };

  /**
   * Спільна склейка К3-13 — `runAdmin`: перший рубіж → роль від субʼєкта
   * → транзакція → мапінг конфліктів БД у 409. 🔴 Фабрика обслуговує ЛИШЕ admin-поверхню: scope 'own' тут
   * структурно непідтримуваний (немає owner-колонки) — `runAdmin` сам
   * кидає fail-loud, 'own'-ресурси (orders/profiles у Е4+) пишуться
   * іменованими операціями, які scope ЧЕСНО звужують.
   */
  const run = <Out>(fn: (db: ActorDb, grant: RequestGrant) => Promise<Out>) =>
    runAdmin(config.operation, fn);

  return {
    entity: config.entity,
    mode: config.mode,
    rowSchema,
    insertSchema,
    updateSchema,
    removeSchema,
    subsetSchema: subsetInputSchema,
    /** Серверна межа сторінки (Е5-12); `undefined` — без межі. Публічна для тесту Е5-14. */
    get maxLimit(): number | undefined {
      return maxLimit;
    },

    list: async ({ data }: { data: SubsetPayload }) =>
      run(async (db) => {
        // 🔴 Каст — назва типу для того самого масиву з SELECT: генерична
        // таблиця в білдері (`resource-list.ts`) зводить тип рядка до
        // `never`. Ціль — `$inferSelect` без omit (не `z.infer` від
        // rowSchema): jsonb-колонки, потрібні адмінці, типізовані в
        // джерелі (`schema/json.ts`), тож рядок серіалізовний для
        // createServerFn (`ValidateSerializable`).
        const rows = await listResourceRows(db, ctx, data.subset ?? {});
        return rows as Row[];
      }),

    // 🔴 А2 (фікс архітектора після Task 4): фабрика сама парсить вхід
    // СВОЄЮ ж схемою, ДО `run` (тобто до першого рубежу/транзакції).
    // `inputValidator` serverFn з admin-server/index.ts робить те саме на
    // межі HTTP, але інваріант «readonly-поле не пишеться generic-write»
    // мусить тримати ОПЕРАЦІЯ: прямий виклик `ops.insert(...)` повз
    // serverFn (харнес-тести, internal-виклики) інакше проносить
    // readonly-поле аж до `.values()`. Zod-схема БЕЗ `.strict()` ("strip")
    // сама відкидає невідомі ключі — `isDefault` у payload insert мовчки
    // зникає, не падає помилкою.
    insert: async ({ data }: { data: z.infer<typeof insertSchema> }) => {
      const parsed = insertSchema.parse(data);
      return run(
        async (db) => (await insertResourceRows(db, ctx, parsed)) as Row[],
      );
    },

    // 🔴 `patchSchema` (resource-schemas.ts) пікає лише writable-ключі й
    // РЕФАЙНИТЬ непорожність ПІСЛЯ strip: patch лише з readonly-полів
    // (напр. `{ isDefault: true }`) стає `{}` і валить `.parse()` тут ЖЕ,
    // ДО `run` — readonly-патч ніколи не доходить до транзакції.
    update: async ({ data }: { data: z.infer<typeof updateSchema> }) => {
      const parsed = updateSchema.parse(data);
      return run(
        async (db) => (await updateResourceRows(db, ctx, parsed)) as Row[],
      );
    },

    remove: async ({ data }: { data: z.infer<typeof removeSchema> }) => {
      const parsed = removeSchema.parse(data);
      return run((db) =>
        removeResourceRows(
          db,
          config.table,
          parsed.map((d) => d.id),
        ),
      );
    },
  };
}

export type AdminResourceOps<T extends Table> = ReturnType<
  typeof defineAdminResource<T, ColumnName<T>, ColumnName<T>>
>;
