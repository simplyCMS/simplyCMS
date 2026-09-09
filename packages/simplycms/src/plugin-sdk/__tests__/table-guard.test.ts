import { describe, expect, it } from 'vitest';
import { assertColumn, assertOwnTable, tablePrefix } from '../server/guard';

/**
 * Межа даних плагіна — ЧИСТА половина (спека §7, рішення B9).
 *
 * 🔴 Що саме тут доводиться: рішення «своя таблиця чи чужа» ухвалює СЕРВЕР.
 * До В2 префікс `plg_` перевіряв хук у браузері, а решту тримала RLS; тепер
 * запит виконує наш хендлер під роллю магазину, тож помилка в цій функції —
 * це прямий доступ плагіна до `orders`. Другу половину (рядок у `plugins`
 * існує) доводить гейт `pnpm test:schema` — вона без БД не перевіряється.
 */
describe('assertOwnTable — власна таблиця плагіна', () => {
  it('пропускає точний префікс і його простір імен', () => {
    expect(assertOwnTable('faq', 'plg_faq')).toBe('plg_faq');
    expect(assertOwnTable('faq', 'plg_faq_items')).toBe('plg_faq_items');
  });

  it('дефіс у назві плагіна стає підкресленням', () => {
    expect(tablePrefix('hello-world')).toBe('plg_hello_world');
    expect(assertOwnTable('hello-world', 'plg_hello_world_notes')).toBe(
      'plg_hello_world_notes',
    );
  });

  it('таблиця ядра відбивається', () => {
    for (const table of ['orders', 'products', 'users', 'user_roles']) {
      expect(() => assertOwnTable('faq', table)).toThrow(/не володіє/);
    }
  });

  it('чужа plg_-таблиця відбивається — префікса plg_ самого по собі мало', () => {
    expect(() => assertOwnTable('faq', 'plg_shipping_rates')).toThrow(
      /не володіє/,
    );
    // 🔴 Найпідступніше: спільний ПОЧАТОК імені без межі підкреслення.
    expect(() => assertOwnTable('faq', 'plg_faqother_items')).toThrow(
      /не володіє/,
    );
  });

  it('спроби вийти за ідентифікатор падають до будь-якої побудови SQL', () => {
    for (const table of [
      'plg_faq_items; drop table orders',
      'public.orders',
      'plg_faq_items"',
      'PLG_FAQ_ITEMS',
      '',
    ]) {
      expect(() => assertOwnTable('faq', table)).toThrow();
    }
  });

  it('колонка теж мусить бути голим ідентифікатором', () => {
    expect(assertColumn('sort_order')).toBe('sort_order');
    for (const column of ['id; drop table orders', 'a"b', '1col', 'A']) {
      expect(() => assertColumn(column)).toThrow(/колонки/);
    }
  });
});
