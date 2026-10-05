import { eq, inArray, type Column, type Table } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import {
  sanitizeRichColumns,
  sanitizeRichRows,
  type RichHtmlColumns,
} from './rich-html';

/**
 * Запис фабрики ресурсу (`resource.ts`): insert/update/remove над уже
 * розпарсеним входом. Винесено з `resource.ts` без зміни поведінки
 * (К3-Е5-3, розпил до ≤150 рядків). Тип рядка називає фабрика
 * (`as Row[]`) — тут масиви `unknown[]`, той самий рантайм-результат
 * `… RETURNING`.
 */
export interface ResourceWriteContext {
  entity: string;
  table: Table;
  /** Е5-7: явна проєкція RETURNING (усі колонки, крім `omit`). */
  picked: Record<string, Column>;
  /** Колонка, яку update ставить у `new Date()` (Е3-9). */
  touch?: string;
  /** Тема 9: колонки з розміткою → профіль санітизатора. */
  richHtml?: RichHtmlColumns;
}

// `never` — як і до розпилу: колонка генеричної таблиці під SQL-білдером.
const idColumn = (table: Table) =>
  (table as unknown as Record<string, never>)['id'];

export async function insertResourceRows(
  db: ActorDb,
  ctx: ResourceWriteContext,
  parsed: Record<string, unknown>[],
): Promise<unknown[]> {
  // 🔴 batch: УСІ рядки транзакції, не [0] — інакше решта оптимістичних
  // мутацій «підтвердяться» локально без запису в БД.
  // UPSTREAM:DRZ-2 — docs/architecture/upstream-workarounds.md: проєкція `picked`
  // (`Record<string, Column>`) не є pg `SelectedFields`; `values(parsed)` кастів не потребує.
  // 🔴 Тема 9, рубіж 1: розмітку чистимо ПІСЛЯ парсингу й ДО SQL, а RETURNING
  // віддаємо через ту саму очистку (рубіж 2) — клієнт ніколи не бачить сирого.
  const clean = parsed.map((row) => sanitizeRichColumns(row, ctx.richHtml));
  const rows: unknown[] = await db
    .insert(ctx.table)
    .values(clean)
    .returning(ctx.picked as never);
  return sanitizeRichRows(rows as Record<string, unknown>[], ctx.richHtml);
}

export async function updateResourceRows(
  db: ActorDb,
  ctx: ResourceWriteContext,
  parsed: readonly { id: unknown; patch: Record<string, unknown> }[],
): Promise<unknown[]> {
  // 🔴 Явна анотація масиву, а не «evolving array» `[]`: під
  // `tsc -p tsconfig.dts.json` (emitDeclarationOnly, build:packages) TS
  // звужує елемент до `never` ще ДО першого `push` (TS2345), а кореневий
  // `pnpm typecheck` цієї розбіжності не бачить (знахідка Е3 Task 8).
  const out: unknown[] = [];
  for (const { id, patch } of parsed) {
    // 🔴 `db.update(table)` з генеричною таблицею не звужує `.returning()`
    // до конкретного масиву (умовний тип `TReturning extends undefined ?
    // QueryResult : TReturning[]` лишається нерозвʼязаним) — каст
    // результату до масиву; той самий рантайм-масив з `UPDATE … RETURNING`.
    const cleanPatch = sanitizeRichColumns(patch, ctx.richHtml);
    const set = ctx.touch
      ? { ...cleanPatch, [ctx.touch]: new Date() }
      : cleanPatch;
    // UPSTREAM:DRZ-2 — docs/architecture/upstream-workarounds.md: та сама проєкція `picked`.
    const rows: unknown[] = await db
      .update(ctx.table)
      .set(set)
      .where(eq(idColumn(ctx.table), id))
      .returning(ctx.picked as never);
    const row = rows[0];
    if (!row)
      throw new Error(
        `[admin-server] ${ctx.entity}: рядка ${String(id)} не існує`,
      );
    out.push(sanitizeRichColumns(row as Record<string, unknown>, ctx.richHtml));
  }
  return out;
}

export async function removeResourceRows(
  db: ActorDb,
  table: Table,
  ids: readonly unknown[],
): Promise<{ count: number }> {
  const id = idColumn(table);
  const rows = await db
    .delete(table)
    .where(inArray(id, ids))
    // Е5-7: для лічильника досить id — прихована колонка не читається.
    .returning({ id });
  return { count: rows.length };
}
