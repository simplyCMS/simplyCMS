import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readInstalledFile } from './lib/installed-package';
import { HANDLER, SSC, TRIPWIRES } from './upstream-tripwires/data';
import {
  activeRecords,
  codeMarkers,
  parityProblems,
  readForTripwire,
  REGISTRY_PATH,
} from './upstream-tripwires/parity';
import {
  buildInsertSql,
  drizzleErrorCause,
  drizzleStillZeroX,
  drizzleWrapsCause,
  insertNamesDefaultedColumns,
  parseSubsetNoOffset,
  shallowError,
  startBody,
  startFnBase,
  startFormBeforeHandler,
  startImportProtectionNoKind,
  subsetOptionsNotReexported,
  tsEslintPeer,
} from './upstream-tripwires/premises';

/**
 * Розтяжки upstream: реєстр `docs/architecture/upstream-workarounds.md` —
 * ЄДИНИЙ список обходів, а цей файл — його виконуваний бік.
 *
 * Навіщо. Обхід живе довше за контекст, у якому його знайшли; реєстр каже
 * «звіряй при бампі», але людина забуває. Тут передумова кожного обходу, яку
 * можна прочитати статично (текст встановленого модуля, версія, SQL білдера),
 * зведена в тест: бамп, що її змінює, червоніє САМ, а не коли хтось згадає.
 * Уроки Е6д: Start вирішує форму через `includes(…)` + `formData()` (стеля
 * тіла дзеркалить цей предикат), а `insert().values()` називає ВСІ колонки
 * (колонковий INSERT-грант дав 42501).
 *
 * Без другого списку. Парність звіряє код із РЕЄСТРОМ в обидва боки:
 *   • маркер `UPSTREAM:<ID>` у коді ⇒ запис активний у реєстрі (закритий
 *     запис чи вигаданий ID — червоний);
 *   • активний запис ⇒ або тут є розтяжка (і запис її називає рядком
 *     `| Розтяжка |`), або сам запис несе `| Розтяжка: немає | <причина> |`;
 *   • активний запис без маркерів у коді ⇒ `| Маркери: немає | <причина> |`.
 * Виняток «статично не перевірити» живе в записі реєстру, не тут.
 *
 * Повідомлення червоного: «UPSTREAM:<ID> — поведінка бібліотеки змінилась».
 * Кожна передумова — чиста функція від тексту й має негативний контроль
 * (підміна рядка → червоний), інакше «зелений» міг би означати «шукає не те».
 */
const hint = (id: string, what: string): string =>
  `UPSTREAM:${id} — поведінка бібліотеки змінилась: переглянь запис у upstream-workarounds.md (${what})`;

describe('розтяжки upstream: передумова обходу досі тримається', () => {
  for (const [id, parts] of Object.entries(TRIPWIRES)) {
    it(`UPSTREAM:${id}`, () => {
      const broken = parts.flatMap((p) =>
        p.premise(readForTripwire(id, p.read)),
      );
      expect(broken, hint(id, broken.join('; '))).toEqual([]);
    });
  }
});

describe('негативний контроль: зниклий файл бібліотеки', () => {
  it('падає повідомленням з ID, пакетом і версією, не сирим ENOENT', () => {
    expect(() =>
      readForTripwire('FAKE-1', () =>
        readInstalledFile(['drizzle-orm'], 'moved/away.js'),
      ),
    ).toThrow(
      /^UPSTREAM:FAKE-1 — файл moved\/away\.js у drizzle-orm@\S+ не знайдено: бібліотека змінила структуру, переглянь запис реєстру$/,
    );
  });
});

describe('негативний контроль: підмінений текст-передумова червоніє', () => {
  const handler = readInstalledFile(SSC, HANDLER);

  it('START-BODY-1: предикат форми без includes(multipart) / без formData()', () => {
    expect(startBody(handler)).toEqual([]);
    expect(
      startBody(handler.replace('"multipart/form-data"', '"multipart/mixed"')),
    ).not.toEqual([]);
    expect(
      startBody(
        handler.replaceAll('await request.formData()', 'await request.text()'),
      ),
    ).not.toEqual([]);
  });

  it('START-BODY-1: базовий шлях без TSS_SERVER_FN_BASE', () => {
    const rpc = readInstalledFile(SSC, 'dist/esm/createServerRpc.js');
    expect(
      startFnBase(rpc.replaceAll('TSS_SERVER_FN_BASE', 'SOMETHING_ELSE')),
    ).not.toEqual([]);
  });

  it('START-1: formData() після хендлера', () => {
    expect(startFormBeforeHandler(handler)).toEqual([]);
    expect(
      startFormBeforeHandler('await action(p); await request.formData();'),
    ).not.toEqual([]);
  });

  it('START-2: parse починає віддавати name', () => {
    const src = readInstalledFile(
      ['@tanstack/react-start', '@tanstack/router-core'],
      'dist/esm/ssr/serializer/ShallowErrorPlugin.js',
    );
    expect(shallowError(src)).toEqual([]);
    expect(
      shallowError(
        src.replaceAll(
          '{ message: ctx.parse(value.message) }',
          '{ message: 1, name: 2 }',
        ),
      ),
    ).not.toEqual([]);
  });

  it('START-IP-1: import-protection починає передавати kind або не повертає результат', () => {
    const src = readInstalledFile(
      ['@tanstack/react-start', '@tanstack/start-plugin-core'],
      'dist/esm/vite/import-protection-plugin/plugin.js',
    );
    expect(startImportProtectionNoKind(src)).toEqual([]);
    expect(
      startImportProtectionNoKind(
        src.replace(
          'const resolveOptions = {',
          'const resolveOptions = { kind: _options.kind,',
        ),
      ),
    ).not.toEqual([]);
    expect(
      startImportProtectionNoKind(
        src.replace(
          'if (passThroughResult) return passThroughResult;',
          'void passThroughResult;',
        ),
      ),
    ).not.toEqual([]);
  });

  it('TSDB-3: parseLoadSubsetOptions повертає offset', () => {
    const src =
      'function parseLoadSubsetOptions(o) { return { limit: o.limit, offset: o.offset }; }\nexport {}';
    expect(parseSubsetNoOffset(src)).not.toEqual([]);
  });

  it('TSDB-4: тип реекспортовано', () => {
    expect(
      subsetOptionsNotReexported(
        'export type { LoadSubsetOptions } from "@tanstack/db";',
      ),
    ).not.toEqual([]);
  });

  it('DRZ-1: сесія не обгортає помилку', () => {
    expect(drizzleWrapsCause('throw e;')).not.toEqual([]);
    expect(drizzleErrorCause('constructor(query, params) {}')).not.toEqual([]);
  });

  it('TSESL-1: peer розширено до TS 7', () => {
    const pkg = JSON.stringify({
      peerDependencies: { typescript: '>=4.8.4 <7.1.0' },
    });
    expect(tsEslintPeer(pkg)).not.toEqual([]);
  });

  it('DRIZ-1: вийшов drizzle-orm 1.x', () => {
    expect(drizzleStillZeroX('1.0.0')).not.toEqual([]);
  });

  it('DRZ-INSERT-1: SQL без колонки з default', () => {
    expect(insertNamesDefaultedColumns(buildInsertSql())).toEqual([]);
    expect(
      insertNamesDefaultedColumns('insert into "t" ("id") values ($1)'),
    ).not.toEqual([]);
  });
});

describe('парність реєстру обходів і коду', () => {
  const registry = readFileSync(REGISTRY_PATH, 'utf8');
  const markers = codeMarkers();
  const ids = Object.keys(TRIPWIRES);

  it('реєстр і код узгоджені в обидва боки', () => {
    expect(parityProblems(registry, markers, ids)).toEqual([]);
  });

  it('негативний контроль: вигаданий маркер у коді червоніє', () => {
    expect(
      parityProblems(registry, new Set([...markers, 'FAKE-9']), ids),
    ).not.toEqual([]);
  });

  it('негативний контроль: розтяжка без запису червоніє', () => {
    expect(parityProblems(registry, markers, [...ids, 'FAKE-9'])).not.toEqual(
      [],
    );
  });

  it('негативний контроль: запис без розтяжки й без винятку червоніє', () => {
    const stripped = registry.replace(/^\| Розтяжка: немає \|.*\n/m, '');
    expect(stripped).not.toBe(registry);
    expect(parityProblems(stripped, markers, ids)).not.toEqual([]);
  });

  it('негативний контроль: закритий запис не рахується активним', () => {
    expect(activeRecords(registry).has('DZOD-1')).toBe(false);
    expect(
      parityProblems(registry, new Set([...markers, 'DZOD-1']), ids),
    ).not.toEqual([]);
  });
});
