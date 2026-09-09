import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { globSync } from 'node:fs';

/**
 * Гард покриття: кожен файл шаблону, який типізує САМ МАГАЗИН, мусить бути
 * в програмі `tsconfig.template.json`.
 *
 * 🔴 Навіщо. Кореневий `tsconfig.json` шаблон виключає (його імпорти
 * резолвляться з `node_modules` магазину, не workspace-аліасами), тож
 * `pnpm typecheck` про нього нічого не знає. Розрив був реальний: помилка
 * типів у `template/routes.ts` проходила `tsc`, `eslint`, `vitest`,
 * `build:packages` і `test:packaging` зеленими — ловив лише `pilot:pack`,
 * якого в CI немає. Дірку закриває `pnpm typecheck:template`, але сам по
 * собі він мовчазний до НОВИХ файлів: доданий у шаблон модуль поза
 * `include` просто не потрапить у програму. Цей тест і стереже той список.
 */

const TEMPLATE = 'packages/create-simplycms-store/template';
const CHECK_CONFIG = 'tsconfig.template.json';

/** JSONC → JSON: у обох конфігах є `//`-коментарі. */
function readJsonc(path: string): Record<string, unknown> {
  const raw = readFileSync(path, 'utf8').replace(/^\s*\/\/.*$/gm, '');
  return JSON.parse(raw) as Record<string, unknown>;
}

/** Файли, які типізує тsconfig САМОГО шаблону (тобто магазин у себе). */
function storeProgramFiles(): string[] {
  const store = readJsonc(join(TEMPLATE, 'tsconfig.json'));
  const include = store.include as string[];
  const files: string[] = [];
  for (const entry of include) {
    const pattern = entry.endsWith('.ts')
      ? join(TEMPLATE, entry)
      : join(TEMPLATE, entry, '**/*.{ts,tsx}');
    files.push(...globSync(pattern));
  }
  return files.map((f) => relative('.', f)).sort();
}

describe('typecheck:template — покриття шаблону', () => {
  const check = readJsonc(CHECK_CONFIG);
  const include = check.include as string[];
  const exclude = check.exclude as string[];

  it('кожен файл програми магазину — у програмі гейта', () => {
    const uncovered = storeProgramFiles().filter((file) => {
      if (exclude.some((e) => file === e || file.startsWith(`${e}/`)))
        return false;
      return !include.some((i) => file === i || file.startsWith(`${i}/`));
    });
    expect(
      uncovered,
      'Ці файли шаблону типізує магазин, але НЕ типізує pnpm typecheck:template — ' +
        'додай їх в `include` tsconfig.template.json (або в `exclude` з поясненням чому)',
    ).toEqual([]);
  });

  it('єдиний виняток — router.tsx, і він обґрунтований', () => {
    // Імпортує згенерований `./routeTree.gen`, якого в шаблоні немає за
    // побудовою; він же синхронізований host-файл, тож типи вже під
    // кореневим `pnpm typecheck`, а байтова парність — під
    // tests/create-store-template-parity.test.ts.
    const templateExcludes = exclude.filter((e) => e.startsWith(TEMPLATE));
    expect(templateExcludes).toEqual([`${TEMPLATE}/src/router.tsx`]);
  });

  it('гейт справді прописаний у реліз-ланцюгу і в CI', () => {
    const gates = readFileSync('scripts/release/gates.mjs', 'utf8');
    expect(gates, 'gates.mjs').toContain('pnpm typecheck:template');
    const ci = readFileSync('.github/workflows/workflow.yml', 'utf8');
    expect(ci, 'workflow.yml').toContain('pnpm typecheck:template');
  });
});
