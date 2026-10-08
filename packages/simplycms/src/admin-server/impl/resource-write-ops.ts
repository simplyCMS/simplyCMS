import type { z } from 'zod';
import type { ActorDb } from 'simplycms/db';
import { lockCatalogTarget } from './catalog-lock';
import type { ResourceGuard, ResourceGuardWrite } from './resource-config';
import {
  insertResourceRows,
  removeResourceRows,
  updateResourceRows,
  type ResourceWriteContext,
} from './resource-write';
import { parseAdminInput, validateAdminInput } from './validation';

interface WriteOpsDeps<Insert, Patch> {
  ctx: ResourceWriteContext;
  run: <Out>(fn: (db: ActorDb) => Promise<Out>) => Promise<Out>;
  insertSchema: z.ZodType<Insert[], Insert[]>;
  updateSchema: z.ZodType<
    { id: string; patch: Patch }[],
    { id: string; patch: Patch }[]
  >;
  removeSchema: z.ZodType<{ id: string }[], { id: string }[]>;
  lock?: string;
  guard?: ResourceGuard<Insert, Patch>;
}

/**
 * Операції запису фабрики `defineAdminResource` (винесено з `resource.ts`,
 * Е6а-16: guard-хук переріс ліміт модуля). Тип рядка `Row` називає фабрика.
 *
 * 🔴 Е6а-16, порядок у транзакції `run`: `lockCatalogTarget(lock)` — ПЕРШИЙ
 * запит → `guard` над УСІМ пакетом → запис. Невалідний будь-який елемент
 * відкочує весь пакет. Без `lock`/`guard` — рівно колишній шлях.
 *
 * Ядра без HTTP (С-2, С-15): кожна операція має db-варіант `*In(db, input)` — те
 * саме тіло в транзакції ВИКЛИКАЧА (сід, порти), без `requireGrant`. Операція
 * = парс + `run(db => тіло(db, parsed))`: парс лишається ДО `run`, тобто
 * невалідний вхід, як і раніше, дає 400 ще до перевірки гранта; тіло спільне,
 * тож lock → guard → запис однакові в обох шляхах.
 */
export function defineWriteOps<Row, Insert, Patch>(
  d: WriteOpsDeps<Insert, Patch>,
) {
  const prepare = async (
    db: ActorDb,
    write: ResourceGuardWrite<Insert, Patch>,
  ) => {
    if (d.lock) await lockCatalogTarget(db, d.lock);
    if (d.guard) await d.guard(db, write);
  };
  type Updates = { id: string; patch: Patch }[];
  // Тіла над уже розпарсеним входом — спільні для операції і `*In`.
  const insertRows = async (db: ActorDb, parsed: Insert[]) => {
    await prepare(db, { kind: 'insert', rows: parsed });
    const rows = parsed as Record<string, unknown>[];
    return (await insertResourceRows(db, d.ctx, rows)) as Row[];
  };
  const updateRows = async (db: ActorDb, parsed: Updates) => {
    await prepare(db, { kind: 'update', updates: parsed });
    const updates = parsed as { id: string; patch: Record<string, unknown> }[];
    return (await updateResourceRows(db, d.ctx, updates)) as Row[];
  };
  // 🔴 Дзеркало чинного `remove`: БЕЗ `prepare` — guard не має варіанта
  // `remove` (`resource-config.ts`); захищене видалення — іменовані операції.
  const removeRows = (db: ActorDb, parsed: { id: string }[]) =>
    removeResourceRows(
      db,
      d.ctx.table,
      parsed.map((r) => r.id),
    );
  return {
    // 🔴 А2 (фікс архітектора після Task 4 Е3): фабрика сама парсить вхід
    // СВОЄЮ ж схемою, ДО `run` (тобто до першого рубежу/транзакції).
    // `validator` serverFn з admin-server/index.ts робить те саме на межі
    // HTTP, але інваріант «readonly-поле не пишеться generic-write» мусить
    // тримати ОПЕРАЦІЯ: прямий виклик `ops.insert(...)` повз serverFn
    // (харнес-тести, internal-виклики) інакше проносить readonly-поле аж до
    // `.values()`. Zod-схема БЕЗ `.strict()` ("strip") сама відкидає невідомі
    // ключі — `isDefault` у payload insert мовчки зникає, не падає помилкою.
    insert: async ({ data }: { data: Insert[] }) => {
      const parsed = parseAdminInput(d.insertSchema, data);
      return d.run((db) => insertRows(db, parsed));
    },

    // 🔴 `patchSchema` (resource-schemas.ts) пікає лише writable-ключі й
    // РЕФАЙНИТЬ непорожність ПІСЛЯ strip: patch лише з readonly-полів
    // (напр. `{ isDefault: true }`) стає `{}` і валить `.parse()` тут ЖЕ,
    // ДО `run` — readonly-патч ніколи не доходить до транзакції.
    update: async ({ data }: { data: Updates }) => {
      const parsed = parseAdminInput(d.updateSchema, data);
      return d.run((db) => updateRows(db, parsed));
    },

    remove: async ({ data }: { data: { id: string }[] }) => {
      const parsed = parseAdminInput(d.removeSchema, data);
      return d.run((db) => removeRows(db, parsed));
    },

    // db-варіанти: та сама схема (strip readonly/insertOnly), але без статусу
    // відповіді — поза запитом його нема куди ставити (С-10); усередині
    // операції 400 поставить межа `runAdminTransactions`.
    insertIn: (db: ActorDb, input: unknown) =>
      insertRows(db, validateAdminInput(d.insertSchema, input)),
    updateIn: (db: ActorDb, input: unknown) =>
      updateRows(db, validateAdminInput(d.updateSchema, input)),
    removeIn: (db: ActorDb, input: unknown) =>
      removeRows(db, validateAdminInput(d.removeSchema, input)),
  };
}
