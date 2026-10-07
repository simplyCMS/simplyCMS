import { inArray, sql } from 'drizzle-orm';
import { discountGroups } from 'simplycms/schema';
import { ADMIN_STATE_CONSTRAINT } from 'simplycms/contracts/domain-errors';
import type { ActorDb } from 'simplycms/db';
import { stateConflict } from '../errors';
import type { ResourceGuardWrite } from '../resource-config';

interface GroupFields {
  parentGroupId?: string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
}

type GroupWrite = ResourceGuardWrite<GroupFields & { id: string }, GroupFields>;

/** Пара дат: обидві задані й початок не раніше кінця — відмова. */
function assertDates(startsAt?: Date | null, endsAt?: Date | null) {
  if (startsAt && endsAt && startsAt >= endsAt)
    stateConflict(ADMIN_STATE_CONSTRAINT.discountGroupDatesInvalid);
}

/**
 * Пара дат групи (ред.2). Рефайн фабрики поколонковий
 * (`resource-schemas.ts`), тож пара перевіряється тут: insert — з рядка,
 * update — злиття ПОТОЧНОГО рядка з patch (patch лише з `endsAt` раніше
 * наявного `startsAt` інакше пройшов би).
 */
async function guardDates(db: ActorDb, write: GroupWrite): Promise<void> {
  if (write.kind === 'insert') {
    for (const row of write.rows) assertDates(row.startsAt, row.endsAt);
    return;
  }
  const touched = write.updates.filter(
    (u) => u.patch.startsAt !== undefined || u.patch.endsAt !== undefined,
  );
  if (touched.length === 0) return;
  const current = await db
    .select({
      id: discountGroups.id,
      startsAt: discountGroups.startsAt,
      endsAt: discountGroups.endsAt,
    })
    .from(discountGroups)
    .where(
      inArray(
        discountGroups.id,
        touched.map((u) => u.id),
      ),
    );
  const byId = new Map(current.map((r) => [r.id, r]));
  for (const { id, patch } of touched) {
    const row = byId.get(id);
    assertDates(
      patch.startsAt !== undefined ? patch.startsAt : row?.startsAt,
      patch.endsAt !== undefined ? patch.endsAt : row?.endsAt,
    );
  }
}

/**
 * Цикл груп (Е6в-17): новий батько — сама група або її нащадок. Рекурсивний
 * CTE ходить ВГОРУ від нового батька по графу «таблиця, поверх якої
 * накладено ВЕСЬ пакет» — інакше пакет `A→B, B→A` пройшов би: кожне ребро
 * окремо безпечне відносно БД. Insert перевіряється так само (рядок, що
 * посилається сам на себе, FK пропускає). `union`, а не `union all`:
 * обхід скінченний навіть на зламаному графі.
 */
async function guardCycle(db: ActorDb, write: GroupWrite): Promise<void> {
  const edges =
    write.kind === 'insert'
      ? write.rows.map((r) => ({ id: r.id, parent: r.parentGroupId }))
      : write.updates.map((u) => ({ id: u.id, parent: u.patch.parentGroupId }));
  const changed = edges.filter(
    (e): e is { id: string; parent: string | null } => e.parent !== undefined,
  );
  if (!changed.some((e) => e.parent !== null)) return;
  const values = sql.join(
    changed.map((e) => sql`(${e.id}::uuid, ${e.parent}::uuid)`),
    sql`, `,
  );
  const result = await db.execute(sql`
    with recursive edge(id, parent) as (values ${values}),
    graph(id, parent) as (
      select g.id, g.parent_group_id from public.discount_groups g
       where g.id not in (select id from edge)
      union all
      select id, parent from edge
    ),
    up(start, id) as (
      select e.id, e.parent from edge e where e.parent is not null
      union
      select up.start, g.parent from up join graph g on g.id = up.id
       where g.parent is not null and up.id <> up.start
    )
    select 1 from up where up.id = up.start limit 1`);
  if (result.rows.length > 0)
    stateConflict(ADMIN_STATE_CONSTRAINT.discountGroupCycle);
}

/**
 * Guard груп знижок (Е6в-17, ред.2) — під `DISCOUNT_CONFIG_LOCK` фабрики,
 * над усім пакетом: паралельне перевішування не проскочить між перевіркою
 * циклу й записом.
 */
export async function guardDiscountGroups(
  db: ActorDb,
  write: GroupWrite,
): Promise<void> {
  await guardDates(db, write);
  await guardCycle(db, write);
}
