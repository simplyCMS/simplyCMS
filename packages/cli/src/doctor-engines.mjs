// doctor №17 (Р32): `engines.simplycms` встановлених плагінів і тем проти версії ядра.
//
// 🔴 Чому error саме тут, а не throw у bootstrap: магазин не цеглиться оновленням ядра —
// bootstrap лише `console.warn`, а невідповідність видно в `doctor`/`status`. `satisfies`
// беремо з ядра МАГАЗИНУ (`simplycms/contracts/semver` через `importFromStore`), а не
// копіюємо: це npm-вирівняна реалізація (тест паритету `semver-npm-parity`), третя копія
// semver у CLI розійшлася б із нею (і з `pg-peer.satisfies`, який пре-релізів не знає).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { configPluginEntries, configThemeEntries } from './config-edit.mjs';
import { importFromStore } from './store-core.mjs';

/** @typedef {import('./ui.mjs').Check} Check */

const ID = 'engines';
const TITLE = 'engines.simplycms плагінів і тем покриває ядро';

/** Літерал `engines: { simplycms: '…' }` у сирцях локального модуля. */
const ENGINES_RE = /engines\s*:\s*\{\s*simplycms\s*:\s*(['"`])([^'"`]+)\1/;

const LOCAL_PREFIX = { plugin: '@plugins/', theme: '@themes/' };
const LOCAL_ROOT = { plugin: 'plugins', theme: 'themes' };

/** Сирці локального модуля (тека магазину): `.ts`/`.tsx` без тестів і node_modules. */
function* sourceFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(path);
    else if (/\.tsx?$/.test(entry.name)) yield path;
  }
}

/**
 * Діапазон з маніфесту модуля: локальний (`@plugins/x`, `@themes/x/index`) — літерал у
 * сирцях теки (TS у Node не імпортується); пакет — `default.manifest.engines` зібраного
 * модуля, імпортованого З МАГАЗИНУ. Нечитне — `{ error }`, не виняток: doctor не падає.
 * @param {string} storeRoot
 * @param {'plugin' | 'theme'} kind
 * @param {string} spec
 * @returns {Promise<{ range?: string; error?: string }>}
 */
export async function readEnginesRange(storeRoot, kind, spec) {
  if (spec.startsWith(LOCAL_PREFIX[kind])) {
    const dirName = spec.slice(LOCAL_PREFIX[kind].length).split('/')[0];
    const dir = join(storeRoot, LOCAL_ROOT[kind], dirName);
    if (!existsSync(dir))
      return { error: `немає теки ${LOCAL_ROOT[kind]}/${dirName}` };
    for (const file of sourceFiles(dir)) {
      const match = ENGINES_RE.exec(readFileSync(file, 'utf8'));
      if (match) return { range: match[2] };
    }
    return {};
  }
  try {
    const module = await importFromStore(storeRoot, spec);
    const range = module.default?.manifest?.engines?.simplycms;
    return typeof range === 'string' ? { range } : {};
  } catch (error) {
    return {
      error: `пакет не вдалося завантажити: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Готує `ctx.engines`: версія й `satisfies` ядра магазину + діапазони всіх плагінів і тем
 * конфігу. `null` — ядра (або його семверу) немає: перевірка стане skip.
 * @param {string} storeRoot
 */
export async function collectEngines(storeRoot) {
  const corePath = join(storeRoot, 'node_modules/simplycms/package.json');
  if (!existsSync(corePath)) return null;
  const coreVersion = JSON.parse(readFileSync(corePath, 'utf8')).version;
  const semver = await importFromStore(
    storeRoot,
    'simplycms/contracts/semver',
  ).catch(() => null);
  if (
    typeof coreVersion !== 'string' ||
    typeof semver?.satisfies !== 'function'
  )
    return null;
  const configPath = join(storeRoot, 'simplycms.config.ts');
  const source = existsSync(configPath) ? readFileSync(configPath, 'utf8') : '';
  const modules = [
    ...(configPluginEntries(source) ?? []).map((e) => ({
      kind: 'plugin',
      label: `плагін «${e.name}» (${e.spec})`,
      spec: e.spec,
    })),
    ...(configThemeEntries(source) ?? []).map((e) => ({
      kind: 'theme',
      label: `тема «${e.key}» (${e.spec})`,
      spec: e.spec,
    })),
  ];
  const items = [];
  for (const { kind, label, spec } of modules)
    items.push({ label, ...(await readEnginesRange(storeRoot, kind, spec)) });
  return { coreVersion, satisfies: semver.satisfies, items };
}

/**
 * Серйозність: хоч одне `error` (діапазон не покриває ядро) → error; відсутній чи
 * нерозбірливий діапазон → warn (сумісність невідома, а не порушена).
 * @param {{ engines?: Awaited<ReturnType<typeof collectEngines>> }} ctx
 * @returns {Check}
 */
export function checkEngines({ engines }) {
  const base = { id: ID, title: TITLE };
  if (!engines)
    return {
      ...base,
      status: 'skip',
      details:
        'ядро не встановлено — версія для порівняння невідома (pnpm install)',
    };
  const { coreVersion, satisfies, items } = engines;
  const errors = [];
  const warns = [];
  for (const { label, range, error } of items) {
    if (error) warns.push(`${label}: ${error}`);
    else if (range === undefined)
      warns.push(
        `${label}: engines.simplycms не задано — сумісність із ядром не декларована`,
      );
    else {
      try {
        if (!satisfies(coreVersion, range))
          errors.push(
            `${label}: engines.simplycms «${range}» не покриває ядро ${coreVersion} — онови плагін або відкоти ядро`,
          );
      } catch (cause) {
        warns.push(
          `${label}: engines.simplycms «${range}» не розпарсився: ${cause instanceof Error ? cause.message : String(cause)}`,
        );
      }
    }
  }
  if (errors.length + warns.length === 0) return { ...base, status: 'ok' };
  return {
    ...base,
    status: errors.length > 0 ? 'error' : 'warn',
    details: [...errors, ...warns].join('\n'),
  };
}
