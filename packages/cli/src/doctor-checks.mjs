// Оффлайн-перевірки doctor (§4.1 спеки, пп. 2–10). Кожна повертає Check
// (ui.mjs); файлові №6–7 живуть у doctor-fs-checks.mjs (ліміт рядків).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { coreDependencies } from './context.mjs';
import { checkHostDrift, checkMigrations } from './doctor-fs-checks.mjs';

/**
 * Контекст перевірок. `hostDir` — канонічна тека host/ пакета CLI;
 * `schemaMigrationsDir` — node_modules/@simplycms/schema/migrations магазину.
 * @typedef {{
 *   storeRoot: string;
 *   manifest: Record<string, unknown>;
 *   env: Record<string, string>;
 *   cliVersion: string;
 *   hostDir: string;
 *   schemaMigrationsDir: string;
 * }} DoctorContext
 * @typedef {import('./ui.mjs').Check} Check
 * @typedef {import('./ui.mjs').CheckStatus} CheckStatus
 */

const KEY_VARS = ['VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY'];

/**
 * Конструктор результату — щоб кожна гілка перевірки була короткою.
 * @param {string} id
 * @param {string} title
 * @param {CheckStatus} status
 * @param {string} [details]
 * @returns {Check}
 */
const check = (id, title, status, details) => ({ id, title, status, details });

/** Файл існує і містить кожен фрагмент — інакше error із переліком відсутніх. */
function checkFileContains(storeRoot, file, fragments, title) {
  const path = join(storeRoot, file);
  if (!existsSync(path))
    return check(file, title, 'error', `Відсутній файл ${file}`);
  const source = readFileSync(path, 'utf8');
  const missing = fragments.filter((fragment) => !source.includes(fragment));
  if (missing.length > 0) {
    const list = missing.map((fragment) => `«${fragment}»`).join(', ');
    return check(file, title, 'error', `У ${file} не знайдено: ${list}`);
  }
  return check(file, title, 'ok');
}

/** №2: усі @simplycms/* — одна версія (error); версія CLI збігається (warn). */
export function checkCoreVersions({ manifest, cliVersion }) {
  const title = 'Версії @simplycms/* синхронні';
  const versions = [...new Set(Object.values(coreDependencies(manifest)))];
  if (versions.length > 1) {
    const details = `Версії розійшлися: ${versions.join(', ')} — вирівняй їх`;
    return check('versions', title, 'error', details);
  }
  if (versions[0] !== cliVersion) {
    const details = `Ядро магазину ${versions[0]}, а CLI — ${cliVersion}: онови CLI разом із ядром`;
    return check('versions', title, 'warn', details);
  }
  return check('versions', title, 'ok');
}

/** №3: packageManager — pnpm 11 (allowBuilds і пін версії — pnpm-специфічні). */
export function checkPackageManager({ manifest }) {
  const title = 'packageManager — pnpm 11';
  const pm = manifest.packageManager;
  if (typeof pm !== 'string' || !/^pnpm@11\./.test(pm)) {
    const shown = typeof pm === 'string' ? pm : 'не задано';
    const details = `packageManager: ${shown} — магазин налаштований під pnpm 11`;
    return check('packageManager', title, 'warn', details);
  }
  return check('packageManager', title, 'ok');
}

/** №4: pnpm-workspace.yaml містить allowBuilds — без нього install падає. */
export function checkAllowBuilds({ storeRoot }) {
  const title = 'pnpm-workspace.yaml містить allowBuilds';
  const path = join(storeRoot, 'pnpm-workspace.yaml');
  if (!existsSync(path) || !/^allowBuilds:/m.test(readFileSync(path, 'utf8'))) {
    const details =
      'Без allowBuilds у pnpm-workspace.yaml pnpm install обривається з ERR_PNPM_IGNORED_BUILDS';
    return check('allowBuilds', title, 'error', details);
  }
  return check('allowBuilds', title, 'ok');
}

/** №5: env несе VITE_SUPABASE_URL + publishable/anon-ключ. */
export function checkEnv({ env }) {
  const title = 'env: VITE_SUPABASE_URL + publishable/anon-ключ';
  const missing = [];
  if (!env.VITE_SUPABASE_URL) missing.push('VITE_SUPABASE_URL');
  if (!KEY_VARS.some((name) => env[name])) missing.push(KEY_VARS.join(' або '));
  if (missing.length > 0) {
    const details = `Не задано: ${missing.join('; ')} (process.env, .env.local або .env)`;
    return check('env', title, 'error', details);
  }
  return check('env', title, 'ok');
}

/** Усі оффлайн-перевірки в порядку таблиці §4.1 (п.1 робить doctor.mjs). */
export function runOfflineChecks(ctx) {
  const { storeRoot } = ctx;
  return [
    checkCoreVersions(ctx),
    checkPackageManager(ctx),
    checkAllowBuilds(ctx),
    checkEnv(ctx),
    checkHostDrift(ctx),
    checkMigrations(ctx),
    // №8–10: якірні файли каркаса — без них магазин не збереться коректно.
    checkFileContains(
      storeRoot,
      'routes.ts',
      [
        'realpathSync',
        '@simplycms/storefront-routes',
        '@simplycms/admin-routes',
      ],
      'routes.ts монтує обидва route-пакети через realpathSync',
    ),
    checkFileContains(
      storeRoot,
      'tailwind.config.ts',
      ['node_modules/@simplycms/'],
      'tailwind.config.ts сканує пакети ядра в node_modules',
    ),
    checkFileContains(
      storeRoot,
      'simplycms.config.ts',
      ['plugins: [', 'themes: {'],
      'simplycms.config.ts має якорі plugins/themes',
    ),
  ];
}
