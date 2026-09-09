// Е0: сіди (`0003_seed.sql`, `demo/demo-seed.sql`) генерують id на клієнті,
// а не покладаються на `DEFAULT gen_random_uuid()` (Task 2, план
// В2-К3-Е0). Task 4 знімає сам DEFAULT — після цього сід без явних `id` не
// накотиться взагалі, тож перевірка мусить бути статичною й випереджати.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATIONS = resolve(import.meta.dirname, '../../../migrations');

// 🔴 Третій елемент — ОЧІКУВАНА кількість `insert into` у файлі, звірена
// вручну (6 у `0003_seed.sql`, 15 у `demo/demo-seed.sql`). Це не косметика:
// `insertColumnLists` матчить лише форму `insert into T ( cols )` і мовчки
// пропускає `insert into T select …` без явного списку колонок (доведено
// негативним контролем нижче) — тобто скан «чи знайдено хоч один INSERT»
// не впав би, якби саме така форма без `id` колись з'явилась у файлі.
// Точне число компенсує цю сліпу зону: розбіжність кількості валить тест
// незалежно від того, чи всі ЗНАЙДЕНІ вставки формально мають `id`.
const SEEDS = [
  ['0003_seed.sql', resolve(MIGRATIONS, '0003_seed.sql'), 6],
  ['demo/demo-seed.sql', resolve(MIGRATIONS, 'demo/demo-seed.sql'), 15],
] as const;

/**
 * Вирізає список колонок кожного `insert into … ( … )`. Дивитись треба
 * саме на нього: скан «чи є десь id» ловив би `select s.id` у підзапиті
 * резолву FK і давав хибне проходження (знахідка аудиту).
 *
 * 🔴 ВІДОМА МЕЖА (знахідка рев'ю, fix round 1): регекс вимагає явний
 * список колонок одразу після імені таблиці. Форма `insert into T select
 * a, b from …` (без дужок — INSERT покладається на порядковий номер
 * колонок таблиці) під нього не підпадає і мовчки випадає з результату.
 * У сідах цієї задачі такої форми немає (усі 21 insert називають список
 * колонок явно), а точне число в `SEEDS` — компенсаційний контроль на
 * випадок, якщо вона колись з'явиться.
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
  it.each(SEEDS)(
    '%s — кожен INSERT називає колонку id',
    (label, path, expectedInserts) => {
      const sql = readFileSync(path, 'utf8');
      const inserts = insertColumnLists(sql);
      expect(
        inserts.length,
        `у ${label} знайдено ${inserts.length} INSERT, очікувалось рівно ${expectedInserts}` +
          ' (точне число — компенсаційний контроль сліпої зони `insert … select` без списку колонок)',
      ).toBe(expectedInserts);
      for (const { table, columns } of inserts) {
        expect(
          columns,
          `${label}: insert into ${table} без колонки id → покладається на DEFAULT`,
        ).toMatch(/(^|[\s,])id([\s,]|$)/);
      }
    },
  );

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

describe('Е0: негативний контроль — гейт справді ловить регресію', () => {
  it('insert із явним списком колонок без id — ловиться (columns не матчить /id/)', () => {
    const sql = `insert into public.foo (name, code) values ('a', 'b');`;
    const inserts = insertColumnLists(sql);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].columns).not.toMatch(/(^|[\s,])id([\s,]|$)/);
  });

  it(
    'ВІДОМА ДІРА: insert … select БЕЗ списку колонок не потрапляє до скану — ' +
      'саме тому кількість insert-ів звіряється точним числом, а не порогом >0',
    () => {
      const sql = `insert into public.foo select 1, 2 from public.bar;`;
      const inserts = insertColumnLists(sql);
      // Якби гейт вище перевіряв лише `toBeGreaterThan(0)`, ця форма без
      // id пройшла б непоміченою: insertColumnLists() її просто не бачить.
      // Точне число вставок у SEEDS — це і є компенсація: якщо ця форма
      // з'явиться в реальному сіді (замінить один із 6/15 insert-ів із
      // явним списком колонок), `inserts.length` розійдеться з очікуваним
      // і головний тест впаде — НАВІТЬ якщо жоден знайдений insert
      // формально не порушує /id/.
      expect(inserts).toHaveLength(0);
    },
  );
});
