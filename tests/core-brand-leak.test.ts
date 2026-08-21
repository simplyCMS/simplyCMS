import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';

/**
 * Гард: назва РЕФЕРЕНС-ТЕМИ не протікає в ядро.
 *
 * 🔴 Навіщо окремий тест. `SolarStore` — бренд пакета
 * `@simplycms/theme-solarstore`, однієї з ВСТАНОВЛЮВАНИХ тем. У ядрі його
 * бути не може: магазин на будь-якій іншій темі малював би чужу назву. За
 * час життя репо це протекло чотири рази — у сторінку входу (`Auth.tsx`,
 * видимий заголовок), у core-каталог `catalog.footer.copyright`, у
 * `admin/dashboard` (uk + en) і в `<title>` роуту `auth/index.tsx`.
 *
 * 🔴 Чому цього не ловили наявні гейти. Обидва i18n-контури шукають
 * КИРИЛИЦЮ — і eslint-селектори, і AST-скан `tests/i18n-coverage`. Назва
 * бренду латиною для них невидима за побудовою, скільки б зон ми не додали.
 *
 * Легітимні місця, які цей гард НЕ чіпає: сам пакет теми; `migrations/` і
 * `seed-migrations/` (SQL immutable за спекою §4.4 — там історичні дані сіду);
 * `skills/` (тексти скіла для агента, не UI магазину).
 */

const SCANNED = ['packages/simplycms/src', 'packages/simplycms/routes'];

/** Рядок-виняток: пояснення в коментарі, чому бренду тут бути не може. */
const ALLOWED = /tests\/core-brand-leak|`SolarStore`/;

function grepBrand(): string[] {
  try {
    const out = execFileSync(
      'git',
      ['grep', '-n', '-F', 'SolarStore', '--', ...SCANNED],
      { encoding: 'utf8' },
    );
    return out.split('\n').filter(Boolean);
  } catch {
    // git grep виходить із кодом 1, коли збігів немає — це успіх.
    return [];
  }
}

describe('ядро не тягне бренд референс-теми', () => {
  it('SolarStore не зустрічається в src/ і routes/ флагмана', () => {
    const leaks = grepBrand().filter((line) => !ALLOWED.test(line));
    expect(
      leaks,
      'Назва референс-теми протекла в ядро. Магазин на іншій темі покаже ' +
        'чужий бренд. Використай нейтральний дефолт (`SimplyCMS Store`) або ' +
        'візьми назву з теми.',
    ).toEqual([]);
  });

  it('гард чутливий — синтетичний витік ловиться', () => {
    // Негативний контроль у пам'яті: та сама фільтрація на підкинутому рядку.
    const synthetic = [
      'packages/simplycms/src/admin/pages/Fake.tsx:7:  <h1>SolarStore</h1>',
    ];
    expect(synthetic.filter((l) => !ALLOWED.test(l))).toHaveLength(1);
  });
});
