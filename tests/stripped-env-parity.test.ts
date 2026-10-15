import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { STRIPPED_ENV } from 'simplycms/prod-start';
import {
  checkStrippedEnvParity,
  parseStrippedEnv,
} from '../scripts/pilot-pack/stripped-env.mjs';

// Дубль `STRIPPED_ENV` у `server.mjs` — свідомий (Е8-Р7′: раннер фільтрує `.env*`
// до імпорту бандла й від ядра не залежить); джерело правди — константа ядра
// `simplycms/prod-start`. Літерал розбирається з САМОГО файлу, не з копії в тесті.
// Запакований магазин проти tarball-а ядра — Gate C пілота (`checkStrippedEnvParity`).
const RUNNERS = [
  'server.mjs',
  'packages/cli/host/server.mjs',
  'packages/create-simplycms-store/template/server.mjs',
];

describe('STRIPPED_ENV: server.mjs ↔ simplycms/prod-start', () => {
  it.each(RUNNERS)('%s — той самий список, що в ядрі', (file) => {
    expect(parseStrippedEnv(readFileSync(file, 'utf8'))).toEqual([
      ...STRIPPED_ENV,
    ]);
  });

  it('розбір відмовляє на відсутньому, подвійному й порожньому літералі', () => {
    expect(() => parseStrippedEnv('const X = 1;')).toThrow(/знайдено 0/);
    const one = "const STRIPPED_ENV = ['A'];\n";
    expect(() => parseStrippedEnv(one + one)).toThrow(/знайдено 2/);
    expect(() => parseStrippedEnv('const STRIPPED_ENV = [];')).toThrow(
      /порожній/,
    );
  });
});

// Gate C на синтетичному скретчі: `simplycms/prod-start` резолвиться з
// node_modules магазину дочірнім процесом — так само, як на запакованому ядрі.
describe('checkStrippedEnvParity (Gate C пілота)', () => {
  const dirs: string[] = [];
  afterAll(() =>
    dirs.forEach((d) => rmSync(d, { recursive: true, force: true })),
  );
  const store = (literal: string, core: string[] | null) => {
    const dir = mkdtempSync(join(tmpdir(), 'stripped-env-'));
    dirs.push(dir);
    writeFileSync(
      join(dir, 'server.mjs'),
      `const STRIPPED_ENV = ${literal};\n`,
    );
    if (core) {
      const pkg = join(dir, 'node_modules/simplycms');
      mkdirSync(pkg, { recursive: true });
      writeFileSync(
        join(pkg, 'package.json'),
        '{ "name": "simplycms", "type": "module", "exports": { "./prod-start": "./ps.mjs" } }',
      );
      writeFileSync(
        join(pkg, 'ps.mjs'),
        `export const STRIPPED_ENV = ${JSON.stringify(core)};\n`,
      );
    }
    return dir;
  };

  it('збіг — ok', () => {
    expect(checkStrippedEnvParity(store("['A']", ['A'])).ok).toBe(true);
  });

  it('ключ лише в ядрі — FAIL з обома списками', () => {
    const result = checkStrippedEnvParity(store("['A']", ['A', 'B']));
    expect(result.ok).toBe(false);
    expect(result.details.join('\n')).toContain('["A","B"]');
  });

  it('субшляху немає в ядрі — FAIL, а не мовчазний збіг', () => {
    expect(checkStrippedEnvParity(store("['A']", null)).ok).toBe(false);
  });
});
