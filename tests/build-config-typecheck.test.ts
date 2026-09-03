import { globSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Гейт покриття конфігів збірки (`packages/*/tsdown.config.ts`).
//
// 🔴 Проблема, яку він закриває. До 2026-08-21 ці файли не типізував НІХТО:
// кореневий `tsconfig.json` виключав їх глобом `**/tsup.config.ts`, пакетні
// конфіги мають `"include": ["src"]`, а `tsconfig.template.json` дивиться в
// шаблон магазину. Через це три конфіги несли невалідний ключ
// `dts: { tsconfig: … }` (у типі `DtsConfig` tsup такого поля не було —
// валідний лише топ-рівневий `tsconfig?: string`), і tsup мовчки його
// ігнорував. Помилка була НІМА: збірка зелена, поведінка «правильна»
// випадково — tsup і так вантажить `./tsconfig.json` із cwd.
//
// 🔴 Інструмент і мутація змінились (трек T, 2026-09-02): пакети збирає
// tsdown, а ТА САМА історична одрука в ньому ЛЕГАЛЬНА —
// `rolldown-plugin-dts` має `tsconfig?: string | boolean`. Збережений якір
// `dts:` тихо перестав би щось доводити, тому негативний контроль
// переведено на `platform` (див. ANCHORS/TYPO нижче).
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
  globSync('packages/*/tsdown.config.ts', { cwd: ROOT })
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

// Якір — рядок, що є в КОЖНОМУ конфізі репо; мутація — літерал поза union-ом
// `'node' | 'neutral' | 'browser'`. Заміна ІНШОГО якоря на `platform: …`
// дала б TS1117 (дубль ключа) і нічого не довела б про union.
//
// 🔴 Очікуваний КОД залежить від форми конфігу — виміряно 2026-09-02 на всіх
// трьох файлах, не вгадано:
//   • `base` окремою змінною з `satisfies UserConfig` (ядро, plugin-faq) →
//     TS2820 (варіант TS2322 із підказкою «did you mean 'node'?») плюс два
//     TS2769 на спреді в `defineConfig`;
//   • інлайн-обʼєкт прямо в `defineConfig` (theme-solarstore) → ЛИШЕ TS2769:
//     `defineConfig` перевантажений, тож помилка властивості згортається в
//     «No overload matches this call» і per-property коду не лишається.
// Спільний для всіх форм — 2769, його й вимагаємо. Специфічності це не
// втрачає: сусідній асерт доводить, що НЕМУТОВАНИЙ той самий файл дає
// порожній набір, тож 2769 тут може бути наслідком лише самої мутації.
const ANCHORS = ["platform: 'node',"] as const;
const TYPO = "platform: 'nodejs',";

describe('конфіги збірки під типізацією', () => {
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
      const anchor = ANCHORS.find((candidate) => source.includes(candidate));
      expect(
        anchor,
        `${where}: немає жодного з якорів «${ANCHORS.join('», «')}»`,
      ).toBeDefined();
      expect(check(file, source), `${where}: чистий конфіг`).toEqual([]);

      const codes = check(file, source.replace(anchor as string, TYPO));
      // TS2769 — «No overload matches this call» на `defineConfig` (див.
      // вимір кодів у шапці ANCHORS/TYPO).
      expect(codes, `${where}: одрук не спійманий`).toContain(2769);
    }
  });
});
