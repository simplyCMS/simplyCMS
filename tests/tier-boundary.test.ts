import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO, eslint, restrictedImports } from './tier-boundary/lint';
import {
  LEGAL_RELATIVE,
  OUTSIDE,
  ZONES,
  toRelativeForms,
} from './tier-boundary/zones';

/**
 * Негативний контроль тір-зон напрямку шарів (ПК3, трек К0).
 *
 * 🔴 Зелений `pnpm lint` доводить лише «у чинному коді порушень немає» — він НЕ
 * доводить, що зона налаштована й ловить порушення: правило, що мовчки
 * відвалилось (одруківка в глобі, зʼїдений `ignores` шлях, порожня група),
 * теж дає зелений лінт. До К0 напрямок шарів стерегла межа npm-пакета плюс
 * `audit-deps`; після злиття 26 пакетів в один стереже ЛИШЕ конфіг — тож
 * контроль обовʼязковий. Прийом той самий, що довів межу довіри плагінів і
 * контракт серверного env: ESLint годується СИНТЕТИЧНИМ порушенням із
 * filePath усередині зони й поза нею.
 *
 * 🔴 Форм крос-тірного імпорту ДВІ, і зона мусить ловити обидві: bare-субшлях
 * `simplycms/<тека>` і відносний шлях `../<тека>`. До К0 другу форму тримала
 * межа npm-пакета; після злиття тек вона стала синтаксично короткою й тому
 * ймовірною. Таблиця зон — `eslint.tier-zones.mjs`, очікування — у
 * `./tier-boundary/zones`.
 */

describe('тір-зони напрямку шарів (no-restricted-imports)', () => {
  it.each(ZONES)(
    '%s — порушення ловиться, легальний імпорт чистий',
    async (dir, forbidden, allowed) => {
      const fixture = `${dir}/__tier-fixture.ts`;

      const errors = await restrictedImports(forbidden, fixture);
      expect(errors, `${forbidden} у ${dir}`).toHaveLength(1);
      expect(errors[0]).toContain('Тір-зона ПК3');

      expect(
        await restrictedImports(allowed, fixture),
        `${allowed} у ${dir}`,
      ).toEqual([]);

      // Той самий код поза зоною — чистий.
      expect(
        await restrictedImports(forbidden, OUTSIDE),
        `${forbidden} поза зоною`,
      ).toEqual([]);
    },
  );

  it.each(ZONES)(
    '%s — ВІДНОСНА форма того самого імпорту теж ловиться',
    async (dir, forbidden) => {
      // Кожне резолвне написання, не лише найкоротше: `../admin` і
      // `../../src/admin` ведуть в одну теку, але для `no-restricted-imports`
      // це різні рядки.
      for (const relative of toRelativeForms(dir, forbidden)) {
        const errors = await restrictedImports(
          relative,
          `${dir}/__tier-fixture.ts`,
        );
        expect(errors, `${relative} у ${dir}`).toHaveLength(1);
        expect(errors[0]).toContain('Тір-зона ПК3');

        expect(
          await restrictedImports(relative, OUTSIDE),
          `${relative} поза зоною`,
        ).toEqual([]);
      }
    },
  );

  it.each(LEGAL_RELATIVE)(
    '%s — відносний імпорт %s лишається легальним',
    async (dir, specifier) => {
      expect(
        await restrictedImports(specifier, `${dir}/__tier-fixture.ts`),
      ).toEqual([]);
    },
  );

  it('глибші рівні `../` теж під зоною (файл у підтеці зони)', async () => {
    const fixture =
      'packages/simplycms/src/storefront-routes/__tier-fixture.ts';
    for (const specifier of [
      '../admin/pages/Products',
      '../../admin/pages/Products',
      '../../../admin/pages/Products',
    ]) {
      expect(
        await restrictedImports(specifier, fixture),
        specifier,
      ).toHaveLength(1);
    }
  });

  it.each(ZONES)(
    '%s — кореневий барель simplycms заборонений зсередини пакета',
    async (dir) => {
      const errors = await restrictedImports(
        'simplycms',
        `${dir}/__tier-fixture.ts`,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('цикл модулів');
    },
  );

  it('кореневий барель поза пакетом легальний (host магазину)', async () => {
    expect(await restrictedImports('simplycms', OUTSIDE)).toEqual([]);
  });

  it('жодну зону не зʼїв ignores (страховка скоупінгу)', async () => {
    for (const [dir] of ZONES) {
      expect(
        await eslint.isPathIgnored(join(REPO, `${dir}/__tier-fixture.ts`)),
        dir,
      ).toBe(false);
    }
    expect(await eslint.isPathIgnored(join(REPO, OUTSIDE))).toBe(false);
  });

  it('тип-імпорт і export-from теж під зоною (не лише value-import)', async () => {
    const fixture = join(
      REPO,
      'packages/simplycms/src/domain/__tier-fixture.ts',
    );
    for (const code of [
      "import type { X } from 'simplycms/admin';\n",
      "export { X } from '../admin';\n",
    ]) {
      const [result] = await eslint.lintText(code, {
        filePath: fixture,
        warnIgnored: true,
      });
      const errors = (result?.messages ?? []).filter(
        (m) => m.ruleId === 'no-restricted-imports',
      );
      expect(errors, code).toHaveLength(1);
    }
  });
});
