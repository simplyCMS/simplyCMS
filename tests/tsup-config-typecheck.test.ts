import { globSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Гейт покриття конфігів збірки (`packages/*/tsup.config.ts`).
//
// 🔴 Проблема, яку він закриває. До 2026-08-21 ці файли не типізував НІХТО:
// кореневий `tsconfig.json` виключав їх глобом `**/tsup.config.ts`, пакетні
// конфіги мають `"include": ["src"]`, а `tsconfig.template.json` дивиться в
// шаблон магазину. Через це три конфіги несли невалідний ключ
// `dts: { tsconfig: … }` (у типі `DtsConfig` такого поля немає — валідний
// лише топ-рівневий `tsconfig?: string`), і tsup мовчки його ігнорував.
// Помилка була НІМА: збірка зелена, поведінка «правильна» випадково —
// tsup і так вантажить `./tsconfig.json` із cwd.
//
// 🔴 Пояснення живе тут, а не коментарем у `tsconfig.json`: кореневий конфіг
// мусить лишатися ЧИСТИМ JSON — `tsconfigAliases`
// (`packages/cli/src/theme-conformance-env.mjs`) читає його `JSON.parse`-ом і
// падає на JSONC з явним «прибери коментарі» (спіймано на `pnpm test`).
//
// Тест доводить дві РІЗНІ речі, і обидві потрібні:
//   1) кожен конфіг із диска входить у програму кореневого `pnpm typecheck`
//      (інакше гейт існує, але не дивиться на файл);
//   2) tsc на цьому файлі реально червоніє від одруку — негативний контроль
//      відтворює саме той дефект, що прожив у репо непоміченим.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TSCONFIG = resolve(ROOT, 'tsconfig.json');

/** Конфіги збірки, знайдені на диску (джерело правди — ФС, не список). */
const onDisk = (): string[] =>
  globSync('packages/*/tsup.config.ts', { cwd: ROOT })
    .map((file) => resolve(ROOT, file))
    .sort();

/** Розібраний кореневий tsconfig: список файлів програми + опції гейта. */
const parseRootConfig = (): ts.ParsedCommandLine => {
  const read = ts.readConfigFile(TSCONFIG, ts.sys.readFile);
  expect(read.error).toBeUndefined();
  return ts.parseJsonConfigFileContent(read.config, ts.sys, ROOT);
};

const parsed = parseRootConfig();

/**
 * Компілятор із оверлеєм: `file` читається з `text`, решта — з диска.
 *
 * Кеш решти файлів спільний на весь набір перевірок — без нього кожна
 * програма перепарсювала б `lib.dom.d.ts` і типи tsup (≈1.5 с проти ≈0.1 с).
 * Оверлей кладемо на РЕАЛЬНИЙ шлях конфігу: так резолв `tsup` і `node:fs`
 * іде звичайним `node_modules` теки пакета, без підміни host-а.
 */
const createOverlayChecker = (): ((file: string, text: string) => number[]) => {
  const host = ts.createCompilerHost(parsed.options, true);
  const readFromDisk = host.getSourceFile.bind(host);
  const cache = new Map<string, ts.SourceFile | undefined>();
  let overlay = { file: '', text: '' };

  host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) => {
    if (resolve(fileName) === overlay.file) {
      return ts.createSourceFile(
        fileName,
        overlay.text,
        languageVersion,
        true,
        ts.ScriptKind.TS,
      );
    }
    if (!cache.has(fileName)) {
      cache.set(
        fileName,
        readFromDisk(fileName, languageVersion, onError, shouldCreate),
      );
    }
    return cache.get(fileName);
  };

  return (file, text) => {
    overlay = { file, text };
    const program = ts.createProgram([file], parsed.options, host);
    // Лишаємо діагностики САМОГО конфігу: опції передані програмно, тож
    // глобальні config-level повідомлення тут — шум, а не сигнал.
    return ts
      .getPreEmitDiagnostics(program)
      .filter((d) => d.file && resolve(d.file.fileName) === file)
      .map((d) => d.code);
  };
};

// Одруку відтворюємо ІСТОРИЧНУ: рівно та форма, яку tsup ігнорував мовчки.
const ANCHOR = 'dts: true,';
const TYPO = "dts: { tsconfig: './tsconfig.json' },";

describe('tsup-конфіги під типізацією', () => {
  const configs = onDisk();

  it('усі конфіги збірки входять у програму кореневого typecheck', () => {
    const inProgram = new Set(parsed.fileNames.map((file) => resolve(file)));
    const missed = configs.filter((file) => !inProgram.has(file));

    expect(configs.length).toBeGreaterThan(0);
    expect(missed.map((file) => relative(ROOT, file))).toEqual([]);
  });

  it('одрук у конфізі валить tsc (негативний контроль)', () => {
    const check = createOverlayChecker();

    for (const file of configs) {
      const source = readFileSync(file, 'utf8');
      const where = relative(ROOT, file);

      // Якір мусить існувати: без нього мутація нічого не міняє і тест
      // «зеленів» би на порожньому місці.
      expect(source, `${where}: немає якоря «${ANCHOR}»`).toContain(ANCHOR);
      expect(check(file, source), `${where}: чистий конфіг`).toEqual([]);

      const codes = check(file, source.replace(ANCHOR, TYPO));
      // TS2353 — «'tsconfig' does not exist in type 'DtsConfig'».
      expect(codes, `${where}: одрук не спійманий`).toContain(2353);
    }
  });
});
