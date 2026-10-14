/**
 * Парність `STRIPPED_ENV`: літерал у `server.mjs` ↔ константа ядра `simplycms/prod-start`.
 *
 * `server.mjs` тримає власний літерал свідомо (Е8-Р7′: раннер фільтрує `.env*` ДО
 * імпорту бандла й від ядра не залежить), тож дубль неминучий — і стережеться
 * розбором САМОГО файлу, а не копією списку в тесті. Той самий розбір читають
 * монорепо-тест (`tests/stripped-env-parity.test.ts`) і Gate C пілота (скретч
 * проти tarball-а ядра).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInStore } from './store-child.mjs';

const LITERAL = /const STRIPPED_ENV = \[([^\]]*)\];/g;

/**
 * Ключі з літерала `const STRIPPED_ENV = [...]`. Кидає, якщо літерала немає,
 * він не один або порожній — інакше парність «зеленіла» б на зламаному розборі.
 *
 * @param {string} source текст `server.mjs`
 * @returns {string[]}
 */
export function parseStrippedEnv(source) {
  const matches = [...source.matchAll(LITERAL)];
  if (matches.length !== 1)
    throw new Error(
      `server.mjs: очікую рівно один літерал STRIPPED_ENV, знайдено ${matches.length}`,
    );
  const keys = [...matches[0][1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  if (keys.length === 0)
    throw new Error('server.mjs: літерал STRIPPED_ENV порожній');
  return keys;
}

const TAG = 'STRIPPED_ENV';

/**
 * Gate C: `server.mjs` скретча ↔ `STRIPPED_ENV` із ЗАПАКОВАНОГО ядра (резолв із
 * `node_modules` скретча дочірнім процесом, не з монорепо).
 *
 * @param {string} storeDir
 * @returns {{ ok: boolean; details: string[] }}
 */
export function checkStrippedEnvParity(storeDir) {
  let literal;
  try {
    literal = parseStrippedEnv(
      readFileSync(join(storeDir, 'server.mjs'), 'utf8'),
    );
  } catch (error) {
    return { ok: false, details: [`FAIL ${error.message}`] };
  }
  const { report, error } = runInStore(
    storeDir,
    {},
    `import { STRIPPED_ENV } from 'simplycms/prod-start';
     console.log('${TAG} ' + JSON.stringify({ keys: STRIPPED_ENV }));`,
    TAG,
  );
  const core = Array.isArray(report?.keys) ? report.keys : null;
  if (core === null)
    return {
      ok: false,
      details: [`FAIL simplycms/prod-start не дав STRIPPED_ENV: ${error}`],
    };
  const same = JSON.stringify(core) === JSON.stringify(literal);
  return {
    ok: same,
    details: [
      `${same ? 'OK  ' : 'FAIL'} STRIPPED_ENV server.mjs ${JSON.stringify(literal)} ↔ ядро ${JSON.stringify(core)}`,
    ],
  };
}
