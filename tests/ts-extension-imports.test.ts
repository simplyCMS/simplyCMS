import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * Гейт VALUE-імпортів з `.ts`/`.tsx`-розширенням (трек T; К2-Е0, T-1, amend).
 *
 * 🔴 Загроза. Кореневий `tsconfig.json` отримав `allowImportingTsExtensions:
 * true` заради РІВНО ОДНОГО імпорту — специфікатора межі клієнт/сервер у
 * кореневому `vite.config.ts` (`.ts`-розширення тут вимагає сам Vite під
 * `configLoader: 'native'`). Але `packages/simplycms/tsconfig.dts.json`
 * УСПАДКОВУЄ кореневий (`extends`), а саме він емітить публікований `.d.ts`
 * (`emitDeclarationOnly`). Тобто прапорець мовчки дозволив би value-імпорт із
 * `.ts` де завгодно в `src/**`: `typecheck` і `build:packages` пройшли б
 * зелено, а рядок поїхав би ДОСЛІВНО в опублікований `.d.ts`, де в магазині
 * без прапорця валить `tsc` з TS5097 у `node_modules` — пізно й дорого.
 * До правки цей клас ловив сам `pnpm typecheck`; тепер — цей тест.
 *
 * 🔴 Чому не окремий `tsconfig.node.json` для конфігів:
 * `tests/build-config-typecheck.test.ts` фіксує канон — конфіги збірки
 * входять у програму КОРЕНЕВОГО `pnpm typecheck`. Другий tsconfig дав би ДВІ
 * програми замість однієї, тобто розкол, який той тест закрив 2026-08-21.
 *
 * Метод: файли — з `ts.parseJsonConfigFileContent` кореневого `tsconfig.json`
 * (та сама програма, що й `pnpm typecheck`, не самописний glob), кожен
 * розбирається СИНТАКСИЧНО (`ts.createSourceFile`, без `Program`/checker).
 * `import type`/`export type` — НЕ знахідка: TS дозволяє їх з `.ts` і без
 * прапорця (доказ у репо — `src/routeTree.gen.ts`).
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TSCONFIG = resolve(ROOT, 'tsconfig.json');

type Hit = { specifier: string; line: number };
type Finding = Hit & { file: string };

/**
 * VALUE-імпорти/експорти/динамічний `import()` зі специфікатором `.ts`/`.tsx`.
 * Розбір синтаксичний, без резолву: неіснуючий файл теж їде в `.d.ts`.
 */
const findValueTsExtensionImports = (fileName: string, text: string): Hit[] => {
  const sourceFile = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: Hit[] = [];

  const record = (specifierNode: ts.Expression) => {
    if (!ts.isStringLiteralLike(specifierNode)) return;
    if (!/\.tsx?$/.test(specifierNode.text)) return;
    const { line } = sourceFile.getLineAndCharacterOfPosition(
      specifierNode.getStart(sourceFile),
    );
    found.push({ specifier: specifierNode.text, line: line + 1 });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      if (!node.importClause?.isTypeOnly) record(node.moduleSpecifier);
    } else if (ts.isExportDeclaration(node)) {
      if (!node.isTypeOnly && node.moduleSpecifier)
        record(node.moduleSpecifier);
    } else if (
      // 🔴 `ts.isImportCall` — внутрішній хелпер компілятора, у ПУБЛІЧНОМУ
      // `typescript.d.ts` його немає (є в рантаймі, TS2339 у typecheck):
      // знахідка, успадкована з Task 1, не моя. Публічний еквівалент —
      // `CallExpression`, чий `expression` має вигляд ключового слова
      // `import` (`SyntaxKind.ImportKeyword`) — так сам компілятор різнить
      // `import('x')` від звичайного виклику функції.
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0]
    ) {
      record(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return found;
};

/**
 * Єдиний легальний випадок — специфікатор межі клієнт/сервер у кореневому
 * `vite.config.ts` (мандат Task 1). Будь-який ІНШИЙ value-імпорт з
 * `.ts`/`.tsx` у програмі кореневого typecheck — витік прапорця.
 */
const ALLOWLIST: ReadonlyArray<{ file: string; specifier: string }> = [
  {
    file: 'vite.config.ts',
    specifier: './packages/simplycms/src/contracts/server-only.ts',
  },
];

describe('value-імпорти з .ts/.tsx (allowImportingTsExtensions)', () => {
  it('чекер: value-імпорт — знахідка, import type — ні (негативний контроль)', () => {
    // 🔴 Без цього тесту другий `it` міг би зеленіти і від «витоку немає»,
    // і від «обхід AST порожній».
    // 🔴 Третій кейс — динамічний `import()`: цю гілку чекера переписано з
    // внутрішнього `ts.isImportCall` на публічну пару, і без інлайн-сніпета
    // її правильність доводилась би лише відсутністю збігів у дереві.
    const check = (code: string) => findValueTsExtensionImports('s.ts', code);
    const found = [{ specifier: './mod.ts', line: 1 }];
    expect(check(`import { x } from './mod.ts';`)).toEqual(found);
    expect(check(`import type { X } from './mod.ts';`)).toEqual([]);
    expect(check(`await import('./mod.ts');`)).toEqual(found);
  });

  it('у програмі кореневого typecheck такий value-імпорт є ЛИШЕ в allowlist', () => {
    const read = ts.readConfigFile(TSCONFIG, ts.sys.readFile);
    expect(read.error).toBeUndefined();
    const { fileNames } = ts.parseJsonConfigFileContent(
      read.config,
      ts.sys,
      ROOT,
    );

    const findings: Finding[] = [];
    for (const file of fileNames) {
      const hits = findValueTsExtensionImports(
        file,
        readFileSync(file, 'utf8'),
      );
      findings.push(
        ...hits.map((hit) => ({ file: relative(ROOT, file), ...hit })),
      );
    }

    // Роздільник — екранований `\u0000`, а не сирий байт: не трапляється в
    // жодному реальному шляху чи специфікаторі, тож ключ однозначний.
    const key = (f: { file: string; specifier: string }) =>
      `${f.file}\u0000${f.specifier}`;
    const allowed = new Set(ALLOWLIST.map(key));
    expect(findings.filter((f) => !allowed.has(key(f)))).toEqual([]);

    // Allowlist мусить лишатись живим: якщо запис зникне з дерева, тест не
    // повинен зеленіти на порожньому місці.
    for (const entry of ALLOWLIST) {
      expect(
        findings,
        `не знайдено: ${entry.file} → ${entry.specifier}`,
      ).toContainEqual(expect.objectContaining(entry));
    }
  });
});
