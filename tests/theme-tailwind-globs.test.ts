import {
  globSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const TAILWIND_CONFIG = join(
  REPO,
  'packages/create-simplycms-store/template/tailwind.config.ts',
);

/**
 * Глоби `content` шаблонного `tailwind.config.ts` — доказ Р7 (Фаза 4).
 *
 * 🔴 Навіщо окремий тест, якщо є Gate D пілота. Маркер solarstore у Gate D
 * зеленіє через СТАРИЙ глоб на `@simplycms`-scope, бо референс-тема живе
 * під scope ядра, — тобто нові глоби сторонніх тем він не доводить узагалі.
 * Тут вони мають власний доказ: синтетичні node_modules під усі три
 * конвенції неймінгу Р1 плюс негативний кейс.
 *
 * 🔴 Це НАБЛИЖЕННЯ сканера Tailwind v4 стандартною glob-семантикою Node
 * (`fs.globSync`): доводиться, що патерн ловить саме ті шляхи, які має
 * ловити, а не те, як Tailwind потім витягує з них класи. Джерело правди
 * патернів — сам шаблонний конфіг: масив вичитується з файлу, а не
 * дублюється тут, інакше тест доводив би власну копію.
 */
function templateContentGlobs(): string[] {
  const source = readFileSync(TAILWIND_CONFIG, 'utf8');
  const block = /\n {2}content: \[\n([\s\S]*?)\n {2}\],\n/.exec(source);
  if (!block)
    throw new Error('У шаблонному tailwind.config.ts немає content: []');
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

/** Фікстура: файл із усіма проміжними теками. */
function touch(root: string, relative: string): void {
  const target = join(root, relative);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, '// фікстура\n', 'utf8');
}

const store = mkdtempSync(join(tmpdir(), 'simplycms-tailwind-globs-'));
afterAll(() => rmSync(store, { recursive: true, force: true }));

/** Пакети-теми трьох конвенцій Р1 + два негативні кейси. */
const FIXTURES = {
  core: 'node_modules/@simplycms/theme-solarstore/dist/index.js',
  unscoped: 'node_modules/simplycms-theme-aurora/dist/index.js',
  scoped: 'node_modules/@vendor/simplycms-theme-aurora/dist/index.js',
  srcOnly: 'node_modules/simplycms-theme-srconly/src/index.tsx',
  notATheme: 'node_modules/@vendor/design-kit/dist/index.js',
} as const;
for (const relative of Object.values(FIXTURES)) touch(store, relative);

describe('Tailwind-глоби шаблону бачать теми-пакети (Р7)', () => {
  const globs = templateContentGlobs();
  const matched = new Set(
    globs.flatMap((pattern) => globSync(pattern, { cwd: store })),
  );

  it('глоби сторонніх тем присутні в шаблоні дослівно', () => {
    expect(globs).toContain('./node_modules/simplycms-theme-*/dist/**/*.js');
    expect(globs).toContain('./node_modules/@*/simplycms-theme-*/dist/**/*.js');
  });

  it.each([
    ['референс ядра @simplycms/theme-*', FIXTURES.core],
    ['стороння без scope simplycms-theme-*', FIXTURES.unscoped],
    ['стороння під чужим scope @vendor/simplycms-theme-*', FIXTURES.scoped],
  ])('%s потрапляє у скан', (_label, relative) => {
    expect(matched).toContain(relative);
  });

  // 🔴 Негативні кейси доводять, що глоби не «ловлять усе»: тема без
  // зібраного dist невидима (вимога конвенції Р3 — класи мусять лишатися в
  // dist-JS), а пакет поза конвенцією неймінгу не сканується взагалі.
  it.each([
    ['тема лише з src/, без dist', FIXTURES.srcOnly],
    ['пакет поза конвенцією неймінгу', FIXTURES.notATheme],
  ])('%s у скан НЕ потрапляє', (_label, relative) => {
    expect(matched).not.toContain(relative);
  });
});
