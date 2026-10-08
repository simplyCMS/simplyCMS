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
import type { ResourceWriteContext } from './resource-write';
import { defineWriteOps } from './resource-write-ops';
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
    richHtml: config.richHtml,
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

  const write = defineWriteOps<
    Row,
    z.infer<typeof insertSchema>[number],
    z.infer<typeof updateSchema>[number]['patch']
  >({
    ctx,
    run,
    insertSchema,
    updateSchema,
    removeSchema,
    lock: config.lock,
    guard: config.guard,
  });

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

    // Е6а-16: lock → guard → запис (`resource-write-ops.ts`). Явні ключі, а
    // не spread: spread знімає readonly з getter-а `maxLimit` у типі.
    insert: write.insert,
    update: write.update,
    remove: write.remove,
    // Showcase (С-2, С-15): ті самі запис/інваріанти в транзакції викликача.
    insertIn: write.insertIn,
    updateIn: write.updateIn,
    removeIn: write.removeIn,
  };
}

export type AdminResourceOps<T extends Table> = ReturnType<
  typeof defineAdminResource<T, ColumnName<T>, ColumnName<T>>
>;
