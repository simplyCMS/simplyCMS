import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'tsdown';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LOWERED_IMPORT_META } from './dist-import-meta/lowered';
import { base } from '../packages/simplycms/tsdown.config';

// Позитивний контроль гейта `dist-import-meta.test.ts` (packaging-suite).
//
// 🔴 Скан «жоден dist-модуль не містить `import_meta`» вакуумний, якщо ніщо не
// доводить, що за цієї конфігурації `import.meta.env` ВИЖИВАЄ збірку: у ядрі
// може не бути жодного такого місця, і гейт зеленів би на будь-якому таргеті.
// Фікстур будує мінімальний модуль із `import.meta.env` справжнім `base` з
// tsdown.config.ts і перевіряє форму виходу.
//
// Перевизначено ЛИШЕ `entry/outDir/cwd/clean/tsconfig`: збірка йде в tmp, не
// чіпає dist пакета й не залежить від його tsconfig. Решта (`target`,
// `platform`, `format`, майбутні хуки чи плагіни `base`) успадковується — НЕ
// перевизначати мовчки, інакше тест перестане доводити конфіг.
//
// У packaging, а не в юніт-сюїті: виміряно 2026-10-11 — сама збірка ~22 мс
// (імпорт tsdown і tsdown.config.ts ще ~0,15 с), тобто швидкодія причиною не є.
// Причина змістовна: тест доводить властивість ПУБЛІКОВАНОГО конфігу збірки і є
// парою до dist-import-meta.test.ts, тож вони ходять разом у релізному ланцюзі.
//
// 🔴 `target` на форму `import.meta` не впливає (виміряно es2015…esnext), тож
// мутація `target: 'es2017'` цей тест НЕ червонить. Червонить `format: ['cjs']`
// у `base`; а cjs-кейс нижче — самоперевірка патерна LOWERED_IMPORT_META.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FLAGSHIP_ENTRY = join(ROOT, 'packages/simplycms/dist/index.js');

let tmp: string;

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), 'tsdown-im-'));
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

/** Збирає фікстур із `base` (+ `extra`) в окремий tmp-outDir, повертає вихідний код. */
async function buildFixture(
  name: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const dir = join(tmp, name);
  const source = join(dir, 'fixture.ts');
  const outDir = join(dir, 'out');
  mkdirSync(dir);
  writeFileSync(source, 'export const v = import.meta.env.VITE_X;\n');

  await build({
    ...base,
    ...extra,
    entry: { fixture: source },
    outDir,
    cwd: dir,
    clean: false,
    tsconfig: false,
  });

  // Що збірка не зачепила dist пакета, доводить кейс із mtime нижче; тут —
  // що вихідні файли справді зʼявилися в tmp-outDir (інакше скан порожній).
  // У tmp немає package.json з type: module, тож розширення — `.mjs`/`.cjs`.
  const outFiles = readdirSync(outDir).filter((f) => /\.[cm]?js$/.test(f));
  expect(outFiles.length).toBeGreaterThan(0);
  return outFiles.map((f) => readFileSync(join(outDir, f), 'utf8')).join('\n');
}

describe('фікстур: base-конфіг tsdown і форма import.meta.env', () => {
  it('esm (base): вихід містить import.meta.env.VITE_X і не лоуерить import.meta', async () => {
    const mtimeBefore = existsSync(FLAGSHIP_ENTRY)
      ? statSync(FLAGSHIP_ENTRY).mtimeMs
      : null;

    const code = await buildFixture('esm');

    expect(code).toContain('import.meta.env.VITE_X');
    expect(code).not.toMatch(LOWERED_IMPORT_META);
    if (mtimeBefore !== null) {
      expect(statSync(FLAGSHIP_ENTRY).mtimeMs).toBe(mtimeBefore);
    }
  });

  it('самоперевірка: cjs ЛОУЕРИТЬ import.meta і патерн це впізнає', async () => {
    // Якщо бамп tsdown/Rolldown змінить форму лоуерення, червоніє цей кейс, а
    // не тихо вакуумніє скан dist (там той самий LOWERED_IMPORT_META).
    const code = await buildFixture('cjs', { format: ['cjs'] });

    expect(code).not.toContain('import.meta.env.VITE_X');
    expect(code).toMatch(LOWERED_IMPORT_META);
  });
});
