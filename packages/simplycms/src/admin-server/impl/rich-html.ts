import {
  sanitizeNullableRichHtml,
  type RichHtmlProfile,
} from 'simplycms/sanitize';

/**
 * Тема 9: санітизація колонок з розміткою в generic-шляху ресурсу адмінки.
 * Чисті функції над уже розпарсеними даними — схеми Zod не чіпають (парність
 * `columnsToZod` з Drizzle-схемою лишається).
 */
export type RichHtmlColumns = {
  readonly [column: string]: RichHtmlProfile | undefined;
};

/** Очищає розмітку в одному рядку/патчі; решту ключів лишає як є. */
export function sanitizeRichColumns<R extends Record<string, unknown>>(
  row: R,
  columns: RichHtmlColumns | undefined,
): R {
  if (columns === undefined) return row;
  let out = row;
  for (const [column, profile] of Object.entries(columns)) {
    const value = row[column];
    if (profile === undefined) continue;
    // Відсутній ключ (partial patch, прихована проєкція) не додаємо; `null`
    // лишається `null`.
    if (typeof value !== 'string') continue;
    if (out === row) out = { ...row };
    (out as Record<string, unknown>)[column] = sanitizeNullableRichHtml(
      value,
      profile,
    );
  }
  return out;
}

export function sanitizeRichRows<R extends Record<string, unknown>>(
  rows: readonly R[],
  columns: RichHtmlColumns | undefined,
): R[] {
  return columns === undefined
    ? [...rows]
    : rows.map((row) => sanitizeRichColumns(row, columns));
}
