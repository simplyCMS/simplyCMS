import { eq, inArray, sql } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { AdminNotFoundError } from 'simplycms/contracts/domain-errors';
import { advisoryXactLockShared, type ActorDb } from 'simplycms/db';
import { LOCK_KEYS } from 'simplycms/db/lock-keys';

/**
 * Корінь перекладного агрегата: таблиця, ключ, колонка версії (ETag) і, якщо є,
 * `updated_at`. `label` — назва сутності у відмові «не знайдено».
 */
export interface AggregateRoot {
  readonly table: PgTable;
  readonly id: PgColumn;
  readonly version: PgColumn;
  /** Колонка `updated_at`, якщо вона є в таблиці кореня. */
  readonly touch?: PgColumn;
  readonly label: string;
}

export type RootLockStrength = 'no key update' | 'update';

/**
 * ЄДИНИЙ носій порядку «`languages-set` -> корені за id» (майстер Р20, Д8): спільний
 * `languages-set` береться ПЕРЕД рядком кореня, інакше зустрічний власник ексклюзивного
 * set (`languages.remove`) дає цикл 40P01. Рядкові замки коренів сильніші за KEY SHARE
 * поза цією функцією заборонені сканером `aggregate-lock-order.test.ts`. Порядок
 * замків агрегата товару й мутації-докази — `products/aggregate/lock-order.ts`.
 */
export async function lockRoots(
  db: ActorDb,
  root: AggregateRoot,
  ids: readonly string[],
  strength: RootLockStrength,
): Promise<Map<string, number>> {
  const unique = [...new Set(ids)].sort();
  if (unique.length === 0) return new Map();
  await advisoryXactLockShared(db, LOCK_KEYS.languagesSet);
  const rows = await db
    .select({ id: root.id, version: root.version })
    .from(root.table)
    .where(inArray(root.id, unique))
    .orderBy(root.id)
    .for(strength);
  return new Map(rows.map((r) => [r.id as string, r.version as number]));
}

/** Один корінь; рядка немає — `AdminNotFoundError(root.label)`. */
export async function lockRoot(
  db: ActorDb,
  root: AggregateRoot,
  id: string,
  strength: RootLockStrength,
): Promise<number> {
  const version = (await lockRoots(db, root, [id], strength)).get(id);
  if (version === undefined) throw new AdminNotFoundError(root.label);
  return version;
}

/**
 * Збільшення версії кореня + запис бази в тій самій транзакції (майстер §3.4): тексти,
 * адреса й дочірні рядки — частина агрегата, а ETag мусить змінитися й від них.
 */
export async function bumpVersion(
  db: ActorDb,
  root: AggregateRoot,
  id: string,
  base?: Readonly<Record<string, unknown>>,
): Promise<number> {
  const [row] = await db
    .update(root.table)
    .set({
      ...base,
      version: sql`${root.version} + 1`,
      ...(root.touch ? { updatedAt: new Date() } : {}),
    })
    .where(eq(root.id, id))
    .returning({ version: root.version });
  return row!.version as number;
}
