// Загальна фабрика рядків «база + переклади» (М2, Р24): форма SQL, від якої
// залежать усі нові перекладні сутності. БД не потрібна — доводиться текст SQL;
// його виконання на справжніх таблицях доводять тести графа товару.
import { describe, expect, it } from 'vitest';
import { inLockedBlock } from './fixtures/product-graph';
import {
  PRIMARY,
  textRowOf,
  translatableStatements,
} from './fixtures/translatable-rows';

describe('textRowOf', () => {
  it('поле → колонка; undefined пропущено, null лишається null', () => {
    expect(
      textRowOf(
        { name: 'name', shortNote: 'short_note', alt: 'alt_text' },
        { name: "O'Neil", shortNote: null },
      ),
    ).toEqual({ name: "'O''Neil'", short_note: 'null' });
  });
});

describe('translatableStatements', () => {
  const statements = translatableStatements({
    table: 'order_statuses',
    base: { sort_order: '3' },
    translationTable: 'order_status_translations',
    ownerColumn: 'status_id',
    id: 'id-1',
    texts: { de: { name: 'Neu' }, [PRIMARY]: { name: 'Нове' } },
    textColumns: { name: 'name' },
  });

  it('база першою, основна мова раніше інших, id власника в кожному рядку', () => {
    expect(statements).toEqual([
      "insert into public.order_statuses (id, sort_order) values ('id-1', 3)",
      `insert into public.order_status_translations (status_id, locale, name) values ('id-1', ${PRIMARY}, 'Нове')`,
      "insert into public.order_status_translations (status_id, locale, name) values ('id-1', 'de', 'Neu')",
    ]);
  });

  it('усі оператори — ОДИН do-блок із INSERT бази й рядком основної мови', () => {
    const sql = inLockedBlock(statements);
    expect(sql.match(/\bdo \$pg\$/g)).toHaveLength(1);
    expect(sql).toContain('insert into public.order_statuses');
    expect(sql).toContain(
      '(select code from public.languages where is_default)',
    );
  });
});
