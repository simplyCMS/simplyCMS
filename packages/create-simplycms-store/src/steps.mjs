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
  if (!result.supabaseUrl) {
    result.supabaseUrl =
      (await ask(() =>
        text({
          message:
            'URL проєкту Supabase (Dashboard → Connect; Enter — пропустити)',
          placeholder: 'https://<project-ref>.supabase.co',
          defaultValue: '',
        }),
      )) || undefined;
  }
  if (result.supabaseUrl && !result.supabaseKey) {
    result.supabaseKey =
      (await ask(() =>
        text({
          message: 'Publishable-ключ Supabase (Enter — пропустити)',
          placeholder: 'sb_publishable_…',
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
export function printNextSteps({ dirLabel, installed, hasEnv }) {
  const steps = [`cd ${dirLabel}`];
  if (!installed) steps.push(`${STORE_MANAGER} install`);
  if (!hasEnv)
    steps.push('cp .env.example .env.local   # ключі з Dashboard → Connect');
  steps.push('supabase link --project-ref <ref> && supabase db push');
  steps.push(
    'OWNER_EMAIL=you@example.com SUPABASE_SERVICE_ROLE_KEY=<key> ' +
      `${STORE_MANAGER} run owner:invite`,
  );
  // Перший крок діагностики: env, host-файли, міграції — до старту dev-сервера.
  steps.push(`${STORE_MANAGER} simplycms doctor   # діагностика магазину`);
  steps.push(`${STORE_MANAGER} run dev`);
  note(steps.join('\n'), 'Наступні кроки');
  log.info(
    'Для хмарного проєкту (supabase db push накочує ЛИШЕ міграції, секція\n' +
      '[auth] із supabase/config.toml на хмару не потрапляє) зроби в Dashboard:\n' +
      '1) Authentication → Email Templates → «Invite user» — продублюй\n' +
      '   supabase/templates/invite.html: стандартний лист не передає\n' +
      '   token_hash, і /auth/confirm його не побачить;\n' +
      '2) Authentication → URL Configuration → Site URL = публічна адреса\n' +
      '   магазину, її ж додай у Redirect URLs. Лінк у листі будується з\n' +
      '   {{ .SiteURL }}, а дефолт проєкту — http://localhost:3000.\n' +
      'CLI-альтернатива п.2 — supabase config push, але він відправляє ВЕСЬ\n' +
      'локальний config.toml і перезапише віддалені auth-налаштування\n' +
      'дефолтами CLI.',
  );
}
