// Е0: сіди (`0003_seed.sql`, `demo/demo-seed.sql`) генерують id на клієнті,
// а не покладаються на `DEFAULT gen_random_uuid()` (Task 2, план
// В2-К3-Е0). Task 4 знімає сам DEFAULT — після цього сід без явних `id` не
// накотиться взагалі, тож перевірка мусить бути статичною й випереджати.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATIONS = resolve(import.meta.dirname, '../../../migrations');

const SEEDS = [
  ['0003_seed.sql', resolve(MIGRATIONS, '0003_seed.sql')],
  ['demo/demo-seed.sql', resolve(MIGRATIONS, 'demo/demo-seed.sql')],
] as const;

/**
 * Вирізає список колонок кожного `insert into … ( … )`. Дивитись треба
 * саме на нього: скан «чи є десь id» ловив би `select s.id` у підзапиті
 * резолву FK і давав хибне проходження (знахідка аудиту).
 */
function insertColumnLists(sql: string): { table: string; columns: string }[] {
  const out: { table: string; columns: string }[] = [];
  const re = /insert\s+into\s+([a-z_.]+)\s*\(([^)]*)\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    out.push({ table: m[1], columns: m[2] });
  }
  return out;
}

describe('Е0: сід детермінований', () => {
  it.each(SEEDS)('%s — кожен INSERT називає колонку id', (label, path) => {
    const sql = readFileSync(path, 'utf8');
    const inserts = insertColumnLists(sql);
    expect(
      inserts.length,
      `у ${label} не знайдено жодного INSERT`,
    ).toBeGreaterThan(0);
    for (const { table, columns } of inserts) {
      expect(
        columns,
        `${label}: insert into ${table} без колонки id → покладається на DEFAULT`,
      ).toMatch(/(^|[\s,])id([\s,]|$)/);
    }
  });

  it.each(SEEDS)('%s — UUID-літерали унікальні', (label, path) => {
    const sql = readFileSync(path, 'utf8');
    const uuids =
      sql.match(
        /'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'/gi,
      ) ?? [];
    expect(uuids.length, `${label}: немає UUID-літералів`).toBeGreaterThan(0);
    expect(new Set(uuids).size, `${label}: дубльовані UUID`).toBe(uuids.length);
  });
});
