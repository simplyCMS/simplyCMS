import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SERVER_ONLY,
  isServerOnlySubpath,
} from 'simplycms/contracts/server-only';
import { closure, distFiles, relativeImports } from './lib/dist-graph';

// Гейт межі клієнт/сервер у ЗІБРАНОМУ ядрі (трек T).
//
// 🔴 Інваріант — ПАРТИЦІЯ, а не «нуль відносних імпортів»: замикання
// серверних entry по відносних імпортах не перетинається із замиканням
// клієнтських. Спільний модуль у зібраному ESM проявляється рівно як
// відносний імпорт — чанком (`../loaders-XXXX.js`) або іншим entry
// (`./impl.js`: Rolldown веде спільні модулі ЧЕРЕЗ entry-файли). Bare-
// специфікатори (`pg`, `simplycms/db`) межу не порушують, а тримають: їх
// бандлер магазину або лишає зовнішніми, або компілятор Start прибирає разом
// із тілами хендлерів.
//
// Хто серверний — каже ЄДИНА декларація `contracts/server-only`; гейт
// перевіряє властивість артефакта і тому чинний до міграції й після неї.
// Що НЕ ловить: інлайн серверного модуля в клієнтський БЕЗ сліду в dist
// (відносний імпорт на джерелі) — це правило `server-only-relative`; і
// витік у сам бандл магазину — це Gate C пілота й Import Protection.

const ROOT = resolve(import.meta.dirname, '..');
const CORE = resolve(ROOT, 'packages/simplycms');
const DIST = join(CORE, 'dist');

/** Усі JS-цілі publishConfig.exports (сирі рядки — з wildcard включно). */
const jsTargets = (): string[] => {
  const pkg = JSON.parse(readFileSync(join(CORE, 'package.json'), 'utf8')) as {
    publishConfig: { exports: Record<string, string | Record<string, string>> };
  };
  return Object.values(pkg.publishConfig.exports)
    .flatMap((value) =>
      typeof value === 'string' ? [value] : Object.values(value),
    )
    .filter((target) => target.endsWith('.js'));
};

/** JS-цілі publishConfig.exports, розгорнуті в реальні файли dist (wildcard включно). */
const entryFiles = (): string[] => {
  const files = distFiles(DIST);
  const expand = (target: string): string[] => {
    if (!target.includes('*'))
      return [resolve(CORE, target)].filter((f) => existsSync(f));
    const parts = target.split('*');
    // 🔴 Друга зірка мовчки з'їла б середину: `'a*b*c'.split('*')` дає три
    // частини, а деструктуризація в дві змінні тихо бере лише першу й
    // останню — glob-збіг тоді був би ширшим, ніж написано в exports.
    if (parts.length !== 2) {
      throw new Error(
        `ціль exports із кількома '*' не підтримується: ${target}`,
      );
    }
    const [prefix, suffix] = parts;
    return files.filter((file) => {
      const rel = `./${relative(CORE, file)}`;
      return rel.startsWith(prefix) && rel.endsWith(suffix);
    });
  };
  return [...new Set(jsTargets().flatMap(expand))];
};

/** `db/index.js` → `db`, `admin-server/impl.js` → `admin-server/impl`. */
const subpathOf = (file: string): string =>
  relative(DIST, file)
    .replace(/\.js$/, '')
    .replace(/\/index$/, '');

/** Явні (без `*`) js-цілі exports, яких немає на диску — не мають тихо відпадати. */
const missingExplicitTargets = (): string[] =>
  jsTargets()
    .filter((target) => !target.includes('*'))
    .filter((target) => !existsSync(resolve(CORE, target)));

const read = (rel: string): string => readFileSync(join(DIST, rel), 'utf8');

describe('межа клієнт/сервер у зібраному ядрі', () => {
  it('dist ядра зібраний і кожне server-only дерево має entry (інакше гейт мовчав би)', () => {
    expect(existsSync(DIST), 'спершу `pnpm build:packages`').toBe(true);
    const entries = entryFiles();
    const server = entries.filter((f) => isServerOnlySubpath(subpathOf(f)));
    for (const sub of SERVER_ONLY) {
      expect(
        server.some(
          (f) => subpathOf(f) === sub || subpathOf(f).startsWith(`${sub}/`),
        ),
        `у dist немає жодного entry під ${sub}`,
      ).toBe(true);
    }
    // 🔴 Захист від вакууму з КЛІЄНТСЬКОГО боку — саме там, де міграція
    // здатна зламати гейт мовчки: 18 із 88 js-цілей exports — wildcard, і
    // якщо бандлер змінить розширення чи вкладеність виходу, glob не
    // збіжиться з жодним файлом, `client` стане порожнім, а тест партиції
    // зеленітиме на порожньому перетині.
    expect(entries.length - server.length).toBeGreaterThan(0);
    // Явні (не-wildcard) цілі не мають тихо відпадати через `existsSync`.
    expect(missingExplicitTargets()).toEqual([]);
  });

  it('замикання серверних entry не перетинається із замиканням клієнтських', () => {
    const entries = entryFiles();
    const server = entries.filter((f) => isServerOnlySubpath(subpathOf(f)));
    const client = entries.filter((f) => !isServerOnlySubpath(subpathOf(f)));
    // Спільний акумулятор: нерезолвлений відносний імпорт — це дірка в
    // обході графа, а не порожня межа. Мовчазна втрата ребра дала б хибний
    // «перетин порожній» так само переконливо, як і чиста партиція.
    const unresolved: string[] = [];
    const clientClosure = closure(client, unresolved);
    const serverClosure = closure(server, unresolved);
    expect(
      unresolved,
      `відносні імпорти, яких обхід не резолвив — граф неповний:\n${unresolved.join('\n')}`,
    ).toEqual([]);
    const shared = [...serverClosure]
      .filter((f) => clientClosure.has(f))
      .map((f) => relative(DIST, f));
    expect(
      shared,
      `серверний код досяжний із клієнтського entry — межа довіри пробита:\n${shared.join('\n')}`,
    ).toEqual([]);
  });

  it('стаб admin-server/index тримає impl BARE-специфікатором', () => {
    // На цьому розрізненні стоїть Gate C: у клієнті легальний СТАБ
    // (`dist/admin-server/index`), але не нутрощі (`dist/admin-server/impl`).
    const code = read('admin-server/index.js');
    expect(code).toContain('simplycms/admin-server/impl');
    expect(
      relativeImports(code).filter((s) => /\/impl(\/index)?(\.js)?$/.test(s)),
    ).toEqual([]);
  });

  // 🔴 Сателіти: інваріант стосується ДЕКЛАРАЦІЙ, а не JS. Їхні .d.ts емітить
  // бандлер (на відміну від ядра, де це tsc), і спільний d.ts-чанк дав би
  // ре-експорт через відносний файл — те, що ламає `moduleResolution: node`
  // у споживача, який не на `bundler`.
  it.each([
    'packages/simplycms-plugin-faq/dist/index.d.ts',
    'packages/simplycms-plugin-faq/dist/pages/FaqAdmin.d.ts',
    'packages/simplycms-theme-solarstore/dist/index.d.ts',
  ])('%s — декларація без відносних ре-експортів', (rel) => {
    const file = resolve(ROOT, rel);
    expect(existsSync(file), `немає ${rel} — спершу pnpm build:packages`).toBe(
      true,
    );
    expect(relativeImports(readFileSync(file, 'utf8'))).toEqual([]);
  });
});
