import {
  existsSync,
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
// 🔴 Мутація, що червонить цей тест, — `format: ['cjs']` у `base` (вихід стає
// `{}.env.VITE_X`). `target: 'es2017'` НЕ червонить: Rolldown не лоуерить
// `import.meta` у ESM-виході за жодного таргета (виміряно: es2015…esnext).

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FLAGSHIP_ENTRY = join(ROOT, 'packages/simplycms/dist/index.js');

let tmp: string;

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), 'tsdown-im-'));
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('фікстур: base-конфіг tsdown зберігає форму import.meta.env', () => {
  it('вихід містить import.meta.env.VITE_X і не лоуерить import.meta', async () => {
    const source = join(tmp, 'fixture.ts');
    const outDir = join(tmp, 'out');
    writeFileSync(source, 'export const v = import.meta.env.VITE_X;\n');
    const mtimeBefore = existsSync(FLAGSHIP_ENTRY)
      ? statSync(FLAGSHIP_ENTRY).mtimeMs
      : null;

    await build({
      ...base,
      entry: { fixture: source },
      outDir,
      cwd: tmp,
      clean: false,
      tsconfig: false,
    });

    // Збірка не мала вийти за tmp: інакше `clean`/outDir могли б зачепити dist.
    expect(outDir.startsWith(tmpdir())).toBe(true);
    // У tmp немає package.json з type: module, тож розширення виходу — `.mjs`.
    const outFiles = readdirSync(outDir).filter((f) => /\.m?js$/.test(f));
    expect(outFiles.length).toBeGreaterThan(0);
    const code = outFiles
      .map((f) => readFileSync(join(outDir, f), 'utf8'))
      .join('\n');

    expect(code).toContain('import.meta.env.VITE_X');
    expect(code).not.toMatch(/import_meta\d*/);
    if (mtimeBefore !== null) {
      expect(statSync(FLAGSHIP_ENTRY).mtimeMs).toBe(mtimeBefore);
    }
  });
});
