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

/**
 * Фінальне повідомлення — одне речення: решту (БД, S3, пошта, міграції,
 * власник) веде агент за скілом `simplycms-onboarding`. Список команд у
 * консолі прокручувався б і розходився з README, тож довідкові кроки для
 * людини без агента лишаються в README магазину.
 */
export function printNextSteps({ dirLabel, skillsPending = false }) {
  // Windows без install: лінки скілів чекають на існуючу ціль (junction), а
  // без них агент не побачить скіл онбордингу.
  if (skillsPending)
    log.warn(
      `Лінки агентних скілів ще не створено — виконайте «cd ${dirLabel}», ` +
        `«${STORE_MANAGER} install» і «${STORE_MANAGER} simplycms update».`,
    );
  note(
    `Магазин створено в ${dirLabel}. Відкрийте агента (Claude Code чи Codex) ` +
      'у цій теці й скажіть: «розгорни магазин».',
    'Далі',
  );
}
