// Оффлайн-перевірки doctor (§4.1 спеки, пп. 2–13). Кожна повертає Check
// (ui.mjs); файлові №6–7 і №12 живуть у doctor-fs-checks.mjs (ліміт рядків).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { coreDependencies } from './context.mjs';
import {
  checkAgentFiles,
  checkHostDrift,
  checkMigrations,
  checkSkillLinks,
} from './doctor-fs-checks.mjs';
import {
  checkEmailVerification,
  checkMailConfigured,
  checkMailDriver,
} from './doctor-mail-check.mjs';
import { checkEngines } from './doctor-engines.mjs';
import { placeholderKeys } from './env-placeholders.mjs';
import { checkPgDriver } from './doctor-pg-check.mjs';
import { checkThemes } from './doctor-theme-checks.mjs';

/**
 * Контекст перевірок. `hostDir` — канонічна тека host/ пакета CLI;
 * `schemaMigrationsDir` — node_modules/simplycms/migrations магазину.
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

/**
 * Серверний контракт env магазину: рівно те, без чого процес не стартує.
 * `VITE_SITE_URL` сюди не входить — без нього магазин працює, лише sitemap
 * лишається без абсолютної бази.
 */
const REQUIRED_ENV_VARS = ['DATABASE_URL', 'BETTER_AUTH_SECRET'];

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

/** №2: усі пакети ядра — одна версія (error); версія CLI збігається (warn). */
export function checkCoreVersions({ manifest, cliVersion }) {
  const title = 'Версії пакетів ядра синхронні';
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

/**
 * №5: env несе серверний контракт магазину.
 *
 * Додатково error на відомих значеннях-заглушках (`env-placeholders.mjs`).
 *
 * 🔴 Гейтяться саме ці два ключі, бо саме вони блокують старт: без
 * `DATABASE_URL` немає пулу `simplycms/db`, без `BETTER_AUTH_SECRET` сервер
 * відмовляється підписувати сесії. Інших ключів до БД магазин не має —
 * браузер до бази не звертається.
 */
export function checkEnv({ env }) {
  const title = `env: ${REQUIRED_ENV_VARS.join(' + ')}`;
  const missing = REQUIRED_ENV_VARS.filter((name) => !env[name]);
  if (missing.length > 0) {
    const details = `Не задано: ${missing.join('; ')} (process.env, .env.local або .env)`;
    return check('env', title, 'error', details);
  }
  // Заглушка з env.example — відомий усім «секрет»: називаємо ключ, не значення.
  const placeholders = placeholderKeys(env);
  if (placeholders.length > 0) {
    const details = `Заглушка з прикладу замість значення: ${placeholders.join('; ')} — задай справжнє`;
    return check('env', title, 'error', details);
  }
  return check('env', title, 'ok');
}

/**
 * Усі оффлайн-перевірки в порядку таблиці §4.1 (п.1 робить doctor.mjs). Це ЄДИНИЙ
 * список для `doctor` і `status`; `label` потрібен `status`, щоб назвати перевірку, що
 * впала чи не вклалась у таймаут (у `Check.id` вона тоді не потрапила).
 * @type {{ label: string; run: (ctx: DoctorContext) => Check }[]}
 */
export const OFFLINE_CHECKS = [
  { label: 'versions', run: checkCoreVersions },
  { label: 'packageManager', run: checkPackageManager },
  { label: 'allowBuilds', run: checkAllowBuilds },
  { label: 'env', run: checkEnv },
  { label: 'host-drift', run: checkHostDrift },
  { label: 'migrations', run: checkMigrations },
  // №8–10: якірні файли каркаса — без них магазин не збереться коректно.
  // 🔴 Роут-теки ядра — підшляхи ОДНОГО пакета (`simplycms/routes/*`), і
  // обидві монтуються через realpathSync: без нього роути мовчки втрачають
  // code-splitting (магазин їде одним initial-чанком).
  {
    label: 'routes.ts',
    run: ({ storeRoot }) =>
      checkFileContains(
        storeRoot,
        'routes.ts',
        ['realpathSync', "coreRoutes('storefront')", "coreRoutes('admin')"],
        'routes.ts монтує роут-теки ядра через realpathSync',
      ),
  },
  {
    label: 'tailwind.config.ts',
    run: ({ storeRoot }) =>
      checkFileContains(
        storeRoot,
        'tailwind.config.ts',
        ['node_modules/simplycms/dist', 'node_modules/simplycms/routes'],
        'tailwind.config.ts сканує пакет ядра в node_modules',
      ),
  },
  {
    label: 'simplycms.config.ts',
    run: ({ storeRoot }) =>
      checkFileContains(
        storeRoot,
        'simplycms.config.ts',
        ['plugins: [', 'themes: {'],
        'simplycms.config.ts має якорі plugins/themes',
      ),
  },
  // №11 (Фаза 4): теми з конфігу резолвляться, Tailwind бачить сторонні.
  { label: 'themes', run: checkThemes },
  // №12 (трек К0): скіли ядра підключені лінками.
  { label: 'skill-links', run: checkSkillLinks },
  // №13 (К3-Е7): драйвер БД — залежність магазину в межах peer ядра.
  { label: 'pg-driver', run: checkPgDriver },
  // №14 (К3-Е8): пошта — nodemailer у залежностях магазину в межах peer ядра.
  { label: 'mail-driver', run: checkMailDriver },
  // №15 (Е8-Р17): драйвер пошти; серйозність log залежить від режиму.
  { label: 'mail-configured', run: checkMailConfigured },
  // №16 (Р30): без SMTP реєстрація не вимагає підтвердження пошти.
  { label: 'email-verification', run: checkEmailVerification },
  // №17 (Р32): engines.simplycms плагінів і тем проти ядра — error, bootstrap лише warn.
  { label: 'engines', run: checkEngines },
  // №18 (Б §3.3): керований блок AGENTS.md і запис хука; дозволи — порадою в details.
  { label: 'agent-files', run: checkAgentFiles },
];

/** Усі оффлайн-перевірки послідовно (`doctor`); `status` ганяє той самий список з таймаутом. */
export function runOfflineChecks(ctx) {
  return OFFLINE_CHECKS.map(({ run }) => run(ctx));
}
