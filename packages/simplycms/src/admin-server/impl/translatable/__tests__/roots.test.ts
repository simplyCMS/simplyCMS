import { pgTable, uuid, integer, timestamp } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import type { ActorDb } from 'simplycms/db';
import { bumpVersion, type AggregateRoot } from '../roots';

// Ключі `set` беруться з колонок кореня, а не з літералів: корінь з іншими іменами
// полів (і без `updated_at`) мусить писати саме свої колонки.
const table = pgTable('t', {
  pk: uuid('pk').primaryKey(),
  rev: integer('rev').notNull(),
  touched: timestamp('touched'),
});

function capture() {
  let set: Record<string, unknown> = {};
  const db = {
    update: () => ({
      set: (v: Record<string, unknown>) => {
        set = v;
        return {
          where: () => ({ returning: async () => [{ version: 2 }] }),
        };
      },
    }),
  } as unknown as ActorDb;
  return { db, keys: () => Object.keys(set).sort() };
}

const root = (touch?: AggregateRoot['touch']): AggregateRoot => ({
  table,
  id: table.pk,
  version: table.rev,
  touch,
  label: 'x',
});

describe('bumpVersion: ключі set з колонок кореня', () => {
  it('корінь без touch не пише updated_at', async () => {
    const c = capture();
    await bumpVersion(c.db, root(), 'id', { extra: 1 });
    expect(c.keys()).toEqual(['extra', 'rev']);
  });

  it('touch з власним ім’ям колонки', async () => {
    const c = capture();
    await bumpVersion(c.db, root(table.touched), 'id');
    expect(c.keys()).toEqual(['rev', 'touched']);
  });
});
