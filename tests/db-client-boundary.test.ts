import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO, eslint, restrictedImports } from './tier-boundary/lint';

/**
 * Негативний контроль зони «зʼєднання лише через withActor» (Task 6, В2-К1а).
 *
 * 🔴 Зелений `pnpm lint` доводить лише «сьогодні ніхто так не пише» — він НЕ
 * доводить, що зона налаштована. Правило, яке мовчки відвалилось (одруківка в
 * патерні, зʼїдений `ignores` шлях, порожня група), дає рівно той самий
 * зелений. Прийом той самий, що довів тір-зони й контракт серверного env:
 * ESLint годується СИНТЕТИЧНИМ імпортом із filePath усередині зони й поза нею.
 *
 * 🔴 Ціна дірки тут вища за звичайний дрейф стилю: голий пул повертає ОБИДВА
 * тихі режими відмови контракту B5″ — запит без `SET LOCAL ROLE` (RLS мовчки
 * не застосовується) і claims поза транзакцією (течуть наступному клієнту
 * пулу). Жоден із них не падає, тож ловити їх мусить лінт.
 *
 * Зона розкладена на три конфіг-блоки (глобальний, тір-зони, межа довіри
 * плагінів) — бо flat config ЗАМІНЮЄ опції правила цілком. Тест і перевіряє
 * кожен із трьох окремо: саме на стику блоків заборона й губиться.
 */

const BARE = 'simplycms/db/client';
const DENIED = /через withActor/;

/** Файли ПОЗА текою db-рантайму, з різних конфіг-блоків зони. */
const OUTSIDE_FILES: ReadonlyArray<readonly [string, string]> = [
  ['host магазину', 'src/routes/my/__db-fixture.ts'],
  ['глобальний блок (скрипт тулчейна)', 'scripts/__db-fixture.mjs'],
  ['тір-зона ядра (T5 core)', 'packages/simplycms/src/core/__db-fixture.ts'],
  ['тір-зона ядра (T5 admin)', 'packages/simplycms/src/admin/__db-fixture.ts'],
  ['роут-тека ядра', 'packages/simplycms/routes/storefront/__db-fixture.tsx'],
  ['локальна тема', 'themes/default/__db-fixture.ts'],
  [
    'референс-тема пакетом',
    'packages/simplycms-theme-solarstore/src/__db-fixture.ts',
  ],
];

/** Файли ВСЕРЕДИНІ db-рантайму: вони і є фабрики, зона їх не стосується. */
const RUNTIME_FILES = [
  'packages/simplycms/src/db/with-actor.ts',
  'packages/simplycms/src/db/index.ts',
  'packages/simplycms/src/db/__tests__/__db-fixture.ts',
];

describe('зона db/client: зʼєднання лише через withActor', () => {
  it.each(OUTSIDE_FILES)(
    '%s — прямий імпорт фабрики відбито',
    async (_, file) => {
      const errors = await restrictedImports(BARE, file);
      expect(errors.join('\n'), file).toMatch(DENIED);
    },
  );

  it('у host-коді це РІВНО одна помилка — не побічний ефект іншої зони', async () => {
    // Точність тут не косметика: якби заборону давала якась сусідня зона
    // (тір-межа, межа довіри), тест вище лишався б зеленим і після видалення
    // самої db-зони. У host-коді жодна інша зона не діє.
    const errors = await restrictedImports(
      BARE,
      'src/routes/my/__db-fixture.ts',
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(DENIED);
  });

  it.each(OUTSIDE_FILES)(
    '%s — ВІДНОСНА форма того самого імпорту теж відбита',
    async (_, file) => {
      // Патерн зони один (`**/db/client`), але саме тому його треба міряти на
      // РІЗНИХ написаннях: bare-субшлях і кожен рівень `../` — для
      // `no-restricted-imports` різні рядки, а не різні модулі.
      for (const relative of [
        '../db/client',
        '../../db/client',
        '../../src/db/client',
      ]) {
        const errors = await restrictedImports(relative, file);
        expect(errors.join('\n'), `${relative} у ${file}`).toMatch(DENIED);
      }
    },
  );

  it.each(RUNTIME_FILES)(
    '%s — сама фабрика лишається доступною',
    async (file) => {
      // Обидві форми: власна `./client` і повний субшлях. Якби `ignores` зони
      // не спрацював, db-рантайм не зміг би зібратись сам із себе.
      expect(await restrictedImports('./client', file), file).toEqual([]);
      expect(await restrictedImports(BARE, file), file).toEqual([]);
    },
  );

  it('публічний вхід simplycms/db лишається легальним', async () => {
    // Контраст: зона забороняє ГОЛУ фабрику, а не доступ до БД як такий.
    // Інакше вона була б не межею, а забороною користуватись рантаймом.
    for (const [, file] of OUTSIDE_FILES) {
      if (file.startsWith('packages/simplycms/src/')) continue; // тір-зони
      expect(await restrictedImports('simplycms/db', file), file).toEqual([]);
    }
  });

  it('плагінам закрито обидва: і фабрика, і публічний вхід', async () => {
    // Межа довіри §7: плагін бере дані портами SDK, які самі вирішують, під
    // яким актором піде транзакція. Блок плагінів ставить власні патерни, тож
    // без явного доливання групи зона тут мовчки б зникла.
    const fixture = 'plugins/hello-world/__db-fixture.ts';
    for (const specifier of [BARE, 'simplycms/db']) {
      const errors = await restrictedImports(specifier, fixture);
      expect(errors.length, `${specifier} у ${fixture}`).toBeGreaterThan(0);
    }
    expect((await restrictedImports(BARE, fixture)).join('\n')).toMatch(
      /plugin-sdk|withActor/,
    );
  });

  it('жодного файлу зони не зʼїв ignores (страховка скоупінгу)', async () => {
    // Файл, схований `ignores` конфігу, дав би 0 повідомлень — тобто зелений
    // тест на непрацюючій зоні. Саме цей клас хиби вилазив на env-контракті.
    for (const [, file] of [
      ...OUTSIDE_FILES,
      ...RUNTIME_FILES.map((f) => ['', f] as const),
    ])
      expect(await eslint.isPathIgnored(join(REPO, file)), file).toBe(false);
  });
});
