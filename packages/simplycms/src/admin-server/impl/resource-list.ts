import { asc, desc, type Column, type SQL, type Table } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import { toDrizzleSubset, type SubsetAllow, type SubsetInput } from './subset';
import { effectiveLimit } from './resource-projection';
import { sanitizeRichRows, type RichHtmlColumns } from './rich-html';
import {
  readJoinOn,
  readSelection,
  type ReadModelSpec,
} from './resource-read-model';

/**
 * Те, що `list` фабрики (`resource.ts`) бере з конфігу ресурсу. Винесено
 * з `resource.ts` без зміни поведінки (К3-Е5-3, розпил до ≤150 рядків).
 */
export interface ResourceListContext {
  entity: string;
  table: Table;
  allow: SubsetAllow;
  defaultOrder?: { column: string; direction: 'asc' | 'desc' };
  maxLimit?: number;
  /** Е5-7: явна проєкція (усі колонки, крім `omit`). */
  picked: Record<string, Column>;
  /** Тема 9: колонки з розміткою → профіль санітизатора (віддача клієнту). */
  richHtml?: RichHtmlColumns;
  /** Читальна вибірка з таблиці перекладів основної мови (`resource-read-model.ts`). */
  readModel?: ReadModelSpec;
}

/**
 * SELECT сторінки ресурсу за subset-ом. Повертає `unknown[]` — тип рядка
 * називає фабрика (`as Row[]` у `resource.ts`): той самий рантайм-масив
 * з SELECT, лише названий конкретним типом.
 */
export async function listResourceRows(
  db: ActorDb,
  ctx: ResourceListContext,
  subset: SubsetInput,
): Promise<unknown[]> {
  const rm = ctx.readModel;
  // Поля read-model перекривають однойменні колонки таблиці скрізь: SELECT, фільтр,
  // сортування й `defaultOrder` бачать ту саму колонку (без латок у споживачах).
  const columns = { ...(ctx.table as object), ...rm?.fields } as Record<
    string,
    Column | undefined
  >;
  const s = toDrizzleSubset(ctx.table, ctx.allow, subset, rm?.fields);
  // UPSTREAM:DRZ-2 — docs/architecture/upstream-workarounds.md: проєкція `Record<string, Column>` (з `getTableColumns(Table)`) не є pg `SelectedFields`;
  // каст лише проєкції, `.from(ctx.table)` кастів не потребує.
  const selection = rm
    ? readSelection(ctx.picked, rm, columns['id'] as Column)
    : ctx.picked;
  let q = db
    .select(selection as never)
    .from(ctx.table)
    .$dynamic();
  if (rm)
    q = q.innerJoin(
      rm.translations,
      await readJoinOn(db, rm, columns['id'] as Column),
    );
  if (s.where) q = q.where(s.where);
  // 🔴 Е3-8: стабільний порядок для offset-пагінації. `created_at` не
  // унікальний (сід/масовий імпорт дають однакові мітки) — без
  // тай-брейкера `id` сторінки дублюють або гублять рядки. Один
  // виклик `.orderBy()` на масив: повторний виклик у Drizzle ЗАМІНЯЄ
  // порядок, а не дописує до нього.
  const order: SQL[] = [];
  if (s.orderBy) order.push(...s.orderBy);
  else if (ctx.defaultOrder) {
    // 🔴 defaultOrder ЗАСТОСОВУЄТЬСЯ (мертвий параметр старої редакції).
    const col = columns[ctx.defaultOrder.column];
    if (col === undefined)
      throw new Error(
        `[admin-server] ${ctx.entity}: defaultOrder.column "${ctx.defaultOrder.column}" немає в таблиці`,
      );
    order.push(ctx.defaultOrder.direction === 'desc' ? desc(col) : asc(col));
  }
  const idCol = columns['id'];
  if (idCol !== undefined) order.push(asc(idCol));
  if (order.length > 0) q = q.orderBy(...order);
  // Е5-12: серверна межа сторінки, якщо ресурс її задав.
  const limit = effectiveLimit(s.limit, ctx.maxLimit);
  if (limit !== undefined) q = q.limit(limit);
  if (s.offset !== undefined) q = q.offset(s.offset);
  return sanitizeRichRows((await q) as Record<string, unknown>[], ctx.richHtml);
}
