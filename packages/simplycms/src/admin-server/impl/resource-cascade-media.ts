import { getTableColumns, getTableName } from 'drizzle-orm';
import type { Table } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';

/**
 * Опція `cascadeMedia` фабрики (Е6д-19): дочірня таблиця, рядки якої FK
 * `ON DELETE CASCADE` видаляє разом із батьком, а вони несуть медіа. Каскад
 * БД рядків `media` не бачить: без опції видалення батька лишало б їх (і
 * файли) живими — публічно доступними за URL і недосяжними для подальших
 * стирань (напр. фото відгуків після видалення товару).
 *
 * `fk` — колонка дочірньої таблиці, що посилається на `id` батька; `column` —
 * медіа-колонка тієї ж таблиці (`text` або `jsonb`-масив референсів);
 * власник рядка `media` — `{ entityType, <id дочірнього рядка> }` (Е6д-16).
 */
export type ResourceCascadeMedia = {
  readonly fk: PgColumn;
  /** Дворівневий каскад (К3-Е6д-1, `sections → section_properties →
   *  property_options`): колонка проміжної таблиці, що посилається на `id`
   *  батька. Тоді `fk` дочірньої таблиці посилається на `id` ПРОМІЖНОЇ. */
  readonly via?: PgColumn;
  readonly column: PgColumn;
  readonly entityType: string;
  /**
   * Колонка з id ВЛАСНИКА файлів, коли власник — не сам дочірній рядок
   * (М1: файли фото й перевизначень належать товару, `media.entity_id` =
   * `product_id`). Колонка з дочірньої таблиці або — за `via` — з проміжної.
   * Без неї власник — `id` дочірнього рядка (Е6д-16).
   */
  readonly owner?: PgColumn;
};

/** Опис покриття для гейта класу (`media-cascade-coverage`): хто кого стирає. */
export type CascadeMediaCoverage = {
  readonly parent: string;
  readonly child: string;
  readonly column: string;
  /** Проміжна таблиця дворівневого каскаду. */
  readonly via?: string;
};

export const idOf = (table: PgTable) => getTableColumns(table)['id'];

/** Рантайм-рубіж конфігу: обидві колонки з однієї дочірньої таблиці з `id`. */
export function assertCascadeMedia(
  table: Table,
  cascade: readonly ResourceCascadeMedia[],
): readonly ResourceCascadeMedia[] {
  for (const { fk, column, via, owner } of cascade) {
    const child = getTableName(fk.table);
    if (owner && owner.table !== fk.table && owner.table !== via?.table)
      throw new Error(
        `[admin-server] ${getTableName(table)}: cascadeMedia ${child}.${column.name} — owner мусить бути з дочірньої чи проміжної таблиці`,
      );
    // Збіг ланцюжка з реальними FK доводить гейт `media-cascade-coverage`.
    const viaBroken = via && (via.table === table || !idOf(via.table));
    if (
      viaBroken ||
      column.table !== fk.table ||
      // Без `id` (складений PK) власник мусить бути заданий явно.
      (!idOf(fk.table) && !owner) ||
      fk.table === table
    )
      throw new Error(
        `[admin-server] ${getTableName(table)}: cascadeMedia ${child}.${column.name} — fk і колонка мусять бути з однієї дочірньої таблиці з id`,
      );
  }
  return cascade;
}

export const cascadeCoverage = (
  table: Table,
  cascade: readonly ResourceCascadeMedia[],
): readonly CascadeMediaCoverage[] =>
  cascade.map(({ fk, column, via }) => ({
    parent: getTableName(table),
    child: getTableName(fk.table),
    column: column.name,
    ...(via && { via: getTableName(via.table) }),
  }));
