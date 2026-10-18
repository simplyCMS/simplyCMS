import { describe, expect, it } from 'vitest';
import { DOC_SYMBOL_ALLOWLIST } from './doc-symbols-exist/data';
import { buildIndex, definedIdentifiers } from './doc-symbols-exist/index';
import {
  collectDocs,
  missingSymbols,
  type DocFile,
} from './doc-symbols-exist/scan';

/**
 * Символи в доках існують у коді.
 *
 * Навіщо. Дока, що називає `eraseMedia` чи `isSafeCssValue` ПІСЛЯ їхнього зносу,
 * бреше мовчки: рев'ю звіряє дифф із планом, а не доки з кодом (уроки Е6д —
 * `deleteMedia` лишився в доках без жодного споживача). Тест бере кожен
 * ідентифікатор у зворотних лапках, схожий на символ коду, і вимагає, щоб він
 * ВИЗНАЧАВСЯ у продакшн-коді.
 *
 * Що сканується: markdown у `docs/architecture` і `docs/development`,
 * `packages/<pkg>/README.md`, README усередині `packages/simplycms/src` та
 * `packages/simplycms/skills`. Архів (`CHANGELOG.md`, `docs/superpowers`) — поза
 * скануванням. Блоки коду (три зворотні лапки) пропускаються — це приклади.
 *
 * «Схожий на символ»: `camelCase` / `PascalCase` з великою літерою всередині або
 * `UPPER_SNAKE`, у лапках цілком, опційно з `()`.
 *
 * Індекс — ВИЗНАЧЕННЯ, а не згадки: після зняття коментарів і вмісту рядків
 * береться `function/class/const/let/var/type/interface/enum`, ключі
 * об'єктів-реєстрів і властивості типів, методи, деструктуризація й
 * `export {…}`, змінні `env.X`, імена файлів-модулів, ключі JSON, іменовані
 * імпорти зі сторонніх пакетів (API бібліотеки, яке код справді кличе).
 * Файли тестів/харнеса/моків дають лише експорти й `UPPER_SNAKE`-константи
 * (гейти, на які посилаються доки); їхні назви тестів і коментарі —
 * ніколи: саме так `deleteMedia` лишався «живим» після зносу.
 *
 * ЯВНИЙ маркер історичної згадки діє на КОНКРЕТНИЙ символ: дужка `(знесено)`
 * або `(замінено …)` мусить стояти БЕЗПОСЕРЕДНЬО після символу в лапках —
 * «`adminLifecycle` (знесено)». Маркер деінде в рядку нічого не гасить.
 *
 * Шум — `DOC_SYMBOL_ALLOWLIST` (`doc-symbols-exist/data.ts`; символ → причина): сторонні API, приклади,
 * заплановане. Список лише скорочується: запис, символ якого з'явився в коді
 * або зник із доків, червоніє (мертвий запис).
 */

// ---------- тести ----------

describe('символи в доках існують у коді', () => {
  const docs = collectDocs();
  const index = buildIndex();
  const missing = missingSymbols(docs, index);

  it('скан бачить доки (не порожній)', () => {
    expect(docs.length).toBeGreaterThan(20);
    expect(index.size).toBeGreaterThan(5000);
  });

  it('кожен символ у доках є в коді, або позначений (знесено)/(замінено …), або в allowlist з причиною', () => {
    const bad = missing.filter((m) => !(m.symbol in DOC_SYMBOL_ALLOWLIST));
    expect(
      bad.map((m) => `\`${m.symbol}\` — ${m.where.join(', ')}`),
      'символу немає в коді: виправ доку, додай у рядок «(знесено)»/«(замінено …)» або, якщо це стороннє API чи приклад, запис у DOC_SYMBOL_ALLOWLIST з причиною',
    ).toEqual([]);
  });

  it('allowlist без мертвих записів і з причинами', () => {
    const stillMissing = new Set(missing.map((m) => m.symbol));
    const dead = Object.keys(DOC_SYMBOL_ALLOWLIST).filter(
      (s) => !stillMissing.has(s),
    );
    expect(
      dead,
      'символ зник із доків або зʼявився в коді — прибери запис, список лише скорочується',
    ).toEqual([]);
    expect(
      Object.values(DOC_SYMBOL_ALLOWLIST).filter((r) => r.trim().length < 10),
    ).toEqual([]);
  });
});

describe('негативний контроль індексу визначень', () => {
  it('середня гілка тернарника не є ключем об’єкта', () => {
    const ids = definedIdentifiers(
      'const x = ok ? deleteMedia : other;\nconst y = ok\n  ? multiLine\n  : z;',
      'source.ts',
    );
    expect(ids).not.toContain('deleteMedia');
    expect(ids).not.toContain('multiLine');
    expect(
      definedIdentifiers('const r = { realKey: 1, opt?: 2 };', 'source.ts'),
    ).toEqual(expect.arrayContaining(['realKey']));
  });

  it('закоментований імпорт стороннього пакета не потрапляє в індекс', () => {
    const src =
      "// import { ghostImport } from 'react';\n/* import { ghostTwo } from 'react'; */\nimport { liveImport } from 'react';";
    const ids = definedIdentifiers(src, 'source.ts');
    expect(ids).not.toContain('ghostImport');
    expect(ids).not.toContain('ghostTwo');
    expect(ids).toContain('liveImport');
  });
});

describe('негативний контроль', () => {
  const index = new Set(['realSymbol', 'REAL_CONST']);
  const doc = (text: string): DocFile[] => [{ path: 'x.md', text }];

  it('знесений символ без маркера червоніє', () => {
    expect(
      missingSymbols(doc('Виклик `eraseMedia` чистить файли.'), index),
    ).toEqual([{ symbol: 'eraseMedia', where: ['x.md:1'] }]);
    expect(
      missingSymbols(doc('Виклик `eraseMedia()` чистить.'), index),
    ).toHaveLength(1);
    expect(missingSymbols(doc('Опція `MAX_FAKE_LIMIT`.'), index)).toHaveLength(
      1,
    );
  });

  it('маркер гасить лише символ, після якого стоїть', () => {
    expect(missingSymbols(doc('`eraseMedia` (знесено).'), index)).toEqual([]);
    expect(
      missingSymbols(doc('`eraseMedia` (замінено на `realSymbol`).'), index),
    ).toEqual([]);
    expect(missingSymbols(doc('(знесено)\n`eraseMedia`'), index)).toHaveLength(
      1,
    );
    // маркер в іншому місці рядка не гасить інший символ
    expect(
      missingSymbols(doc('`ghostOne` (знесено), але `ghostTwo` живий'), index),
    ).toEqual([{ symbol: 'ghostTwo', where: ['x.md:1'] }]);
  });

  it('існуючі символи, прості слова й блоки коду не шумлять', () => {
    expect(
      missingSymbols(
        doc('`realSymbol` `REAL_CONST()` `React` `foo` `a.bC`'),
        index,
      ),
    ).toEqual([]);
    expect(
      missingSymbols(doc('```ts\nfakeSymbolHere();\n```\n`realSymbol`'), index),
    ).toEqual([]);
  });

  it('номер рядка не зсувається блоками коду', () => {
    const found = missingSymbols(
      doc('a\n```\nx\ny\n```\n`ghostSymbol`'),
      index,
    );
    expect(found[0]?.where).toEqual(['x.md:6']);
  });
});
