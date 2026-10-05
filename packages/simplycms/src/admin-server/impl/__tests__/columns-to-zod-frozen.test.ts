import { describe, expect, it } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import type { Column, Table } from 'drizzle-orm';
import type { z } from 'zod';
import {
  orderItems,
  orders,
  products,
  sectionProperties,
  productPrices,
} from 'simplycms/schema';
import { columnsToZod } from '../columns-to-zod';
import type { SchemaMode } from '../columns-to-zod';

// «Заморожений намір» (без drizzle-zod): ключові твердження на колонках
// РЕАЛЬНИХ таблиць ядра — лишаються, коли еталон піде з залежностей (Task 13).
const col = (t: Table, mode: SchemaMode, key: string): z.ZodType =>
  columnsToZod(t, mode)[key]!;
const ok = (s: z.ZodType, v: unknown) => s.safeParse(v).success;
const raw = (t: Table, key: string): Column => getTableColumns(t)[key]!;

describe('columnsToZod: frozen intent на реальних таблицях', () => {
  it('orders.total (numeric) — лише рядок', () => {
    const s = col(orders, 'select', 'total');
    expect(ok(s, '10.50')).toBe(true);
    expect(ok(s, 10.5)).toBe(false);
  });
  it('products.slug (varchar 255) — 255 так, 256 ні', () => {
    const s = col(products, 'select', 'slug');
    expect(ok(s, 'a'.repeat(255))).toBe(true);
    expect(ok(s, 'a'.repeat(256))).toBe(false);
  });
  it('orders.orderNumber (varchar 50) — 51 символ відхилено', () => {
    expect(ok(col(orders, 'insert', 'orderNumber'), 'a'.repeat(51))).toBe(
      false,
    );
  });
  it('products.name (text) — довгий рядок проходить', () => {
    expect(ok(col(products, 'select', 'name'), 'a'.repeat(10_001))).toBe(true);
  });
  it('integer (orderItems.quantity): 2147483648 і дробове відхилені', () => {
    const s = col(orderItems, 'insert', 'quantity');
    expect(ok(s, 2147483647)).toBe(true);
    for (const v of [2147483648, -2147483649, 1.5, NaN, Infinity]) {
      expect(ok(s, v)).toBe(false);
    }
  });
  it('created_at: Invalid Date, рядок і число відхилені', () => {
    const s = col(products, 'select', 'createdAt');
    expect(ok(s, new Date())).toBe(true);
    for (const v of [new Date('invalid'), '2026-01-01', 0]) {
      expect(ok(s, v)).toBe(false);
    }
  });
  it('enum (sectionProperties.propertyType): член так, чужий ні', () => {
    const s = col(sectionProperties, 'select', 'propertyType');
    expect(ok(s, 'select')).toBe(true);
    expect(ok(s, 'nope')).toBe(false);
  });
  it('uuid: products.id лише uuid', () => {
    const s = col(products, 'select', 'id');
    expect(ok(s, crypto.randomUUID())).toBe(true);
    expect(ok(s, '')).toBe(false);
  });
  it('boolean: products.isActive не приймає рядок', () => {
    expect(ok(col(products, 'select', 'isActive'), 'true')).toBe(false);
  });
  it('insert: notNull без default (products.name) — обовʼязкова', () => {
    expect(ok(col(products, 'insert', 'name'), undefined)).toBe(false);
  });
  it('insert: notNull з default (isActive) — optional', () => {
    expect(ok(col(products, 'insert', 'isActive'), undefined)).toBe(true);
  });
  it('nullable: sectionId приймає null у всіх режимах', () => {
    for (const m of ['insert', 'update', 'select'] as const) {
      expect(ok(col(products, m, 'sectionId'), null)).toBe(true);
    }
  });
  it('notNull не приймає null', () => {
    expect(ok(col(products, 'insert', 'name'), null)).toBe(false);
  });
  it('update: усі колонки optional; select: жодна', () => {
    const upd = columnsToZod(productPrices, 'update');
    const sel = columnsToZod(productPrices, 'select');
    expect(Object.values(upd).every((s) => ok(s, undefined))).toBe(true);
    expect(Object.values(sel).some((s) => ok(s, undefined))).toBe(false);
  });
  it('форма містить рівно ключі таблиці (немає згенерованих-завжди)', () => {
    for (const m of ['insert', 'update', 'select'] as const) {
      expect(Object.keys(columnsToZod(orders, m)).sort()).toEqual(
        Object.keys(getTableColumns(orders)).sort(),
      );
    }
    expect(raw(orders, 'total').notNull).toBe(true);
  });
});
