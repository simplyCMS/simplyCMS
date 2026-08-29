// Кроки CLI, винесені з index.mjs: промпти, git, встановлення, фінальний вивід.
import { execSync } from 'node:child_process';
import { cancel, confirm, isCancel, log, note, text } from '@clack/prompts';

/** Обгортка промпту: Ctrl+C має завершувати CLI, а не давати symbol далі. */
async function ask(run) {
  const value = await run();
  if (isCancel(value)) {
    cancel('Скасовано.');
    process.exit(0);
  }
  return value;
}

/** Питаємо лише те, чого не задано прапорцями — прапорець сильніший за промпт. */
export async function promptMissing(options) {
  const result = { ...options };
  if (!result.storeName) {
    result.storeName = await ask(() =>
      text({
        message: 'Тека нового магазину',
        placeholder: 'my-shop',
        defaultValue: 'my-shop',
      }),
    );
  }
  if (!result.databaseUrl) {
    result.databaseUrl =
      (await ask(() =>
        text({
          message: 'Підключення до Postgres, DATABASE_URL (Enter — пропустити)',
          placeholder:
            'postgresql://app_runtime:пароль@localhost:5432/postgres',
          defaultValue: '',
        }),
      )) || undefined;
  }
  if (result.install) {
    result.install = await ask(() =>
      confirm({ message: 'Встановити залежності зараз?', initialValue: true }),
    );
  }
  return result;
}

/**
 * Магазин підтримує ЛИШЕ pnpm — і це не смак, а вимога конфігурації.
 *
 * 🔴 `pnpm-workspace.yaml` шаблону несе `allowBuilds`, без якого install
 * обривається, а `packageManager` у манифесті прибиває версію. Обидва
 * механізми pnpm-специфічні: npm/yarn їх просто ігнорують і зберуть магазин
 * у неперевіреній конфігурації. Тому детекції менеджера тут більше немає —
 * лише попередження, якщо CLI запустили не через pnpm.
 */
export const STORE_MANAGER = 'pnpm';

/** Чи запущено CLI не-pnpm менеджером — привід попередити, не впасти. */
export function detectForeignManager(env = process.env) {
  const agent = env.npm_config_user_agent ?? '';
  const name = agent.split('/')[0];
  return name && name !== 'pnpm' ? name : null;
}

/** Перший коміт. Відсутній git — привід для попередження, а не для падіння. */
export function initGit(targetDir) {
  try {
    execSync('git init -q', { cwd: targetDir, stdio: 'ignore' });
    execSync('git add -A', { cwd: targetDir, stdio: 'ignore' });
    execSync('git commit -q -m "chore: init simplycms store"', {
      cwd: targetDir,
      stdio: 'ignore',
    });
    return true;
  } catch {
    log.warn('git-репозиторій не створено — ініціалізуй вручну.');
    return false;
  }
}

/** Встановлення залежностей магазину. Мережева помилка не має стирати скаффолд. */
export function installDeps(targetDir) {
  const foreign = detectForeignManager();
  if (foreign) {
    log.warn(
      `CLI запущено через ${foreign}, але магазин налаштований під pnpm 11+ ` +
        '(allowBuilds, packageManager). Ставлю через pnpm.',
    );
  }
  try {
    execSync(`${STORE_MANAGER} install`, { cwd: targetDir, stdio: 'inherit' });
    return true;
  } catch {
    log.warn(
      `Не вдалось встановити залежності — запусти «${STORE_MANAGER} install». ` +
        'Потрібен pnpm 11+; якщо реліз ядра свіжіший за добу, установка ' +
        'впреться в minimumReleaseAge (див. pnpm-workspace.yaml магазину).',
    );
    return false;
  }
}

/** Наступні кроки — те саме, що в README згенерованого магазину. */
export function printNextSteps({
  dirLabel,
  installed,
  hasEnv,
  skillsPending = false,
}) {
  const steps = [`cd ${dirLabel}`];
  if (!installed) steps.push(`${STORE_MANAGER} install`);
  // Windows без install: лінки скілів чекають на існуючу ціль (junction).
  if (skillsPending)
    steps.push(`${STORE_MANAGER} simplycms update   # лінки агентних скілів`);
  if (!hasEnv)
    steps.push('cp .env.example .env.local   # три ключі контракту магазину');
  // 🔴 Накат схеми — psql по канону міграцій, а не `supabase db push`: канон
  // нумерований послідовно (`0000_prelude.sql`), а Supabase CLI чекає
  // `<timestamp>_<name>.sql` і такі імена відхиляє.
  //
  // 🔴 URL тут — ПРИВІЛЕЙОВАНИЙ (власник БД), а НЕ `DATABASE_URL` із
  // `.env.local`. `0000_prelude.sql` створює ролі й безумовно робить
  // `alter role app_runtime …`, а сама `app_runtime` — `nosuperuser
  // nocreatedb nocreaterole`, тож під нею накат падає за будь-якого стану
  // бази (`permission denied for database`, `permission denied to alter
  // role`, або роль ще не існує на чистому кластері). Це bootstrap-крок
  // людини, а не рантайм-ключ, тому нової змінної в контракті магазину не
  // заводимо — URL підставляється руками.
  steps.push(
    '# накат канону — підключенням ВЛАСНИКА БД, не app_runtime із .env.local:\n' +
      'for f in supabase/migrations/*.sql; do ' +
      'psql "postgresql://<owner>:<pass>@<host>:5432/<db>" ' +
      '-v ON_ERROR_STOP=1 -f "$f"; done',
  );
  // 🔴 service_role-ключа тут більше немає: запрошення власника випускається
  // прямо в Postgres (контракт v2), тож потрібен лише DATABASE_URL із
  // .env.local. Посилання скрипт друкує в консоль — SMTP магазин не має.
  steps.push(`OWNER_EMAIL=you@example.com ${STORE_MANAGER} run owner:invite`);
  // Перший крок діагностики: env, host-файли, міграції — до старту dev-сервера.
  steps.push(`${STORE_MANAGER} simplycms doctor   # діагностика магазину`);
  steps.push(`${STORE_MANAGER} run dev`);
  note(steps.join('\n'), 'Наступні кроки');
  // 🔴 Auth-налаштувань у Dashboard тут більше немає: вхід і запрошення
  // працюють на Better Auth поверх самого Postgres, а не на GoTrue. Лишається
  // рівно те, без чого owner:invite не запуститься — серверні ключі .env.local
  // і той факт, що посилання доведеться взяти з консолі, а не з пошти.
  log.info(
    'Перед owner:invite заповни в .env.local серверні ключі:\n' +
      '  DATABASE_URL       — підключення роллю app_runtime;\n' +
      '  BETTER_AUTH_SECRET — openssl rand -base64 32.\n' +
      'Лист магазин не шле (SMTP не налаштований) — одноразове посилання\n' +
      'на /auth/invite скрипт надрукує в консоль. Воно дійсне 24 год,\n' +
      'повторний прогін команди перевипускає його.',
  );
}
