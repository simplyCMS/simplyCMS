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

/** Менеджер пакетів, яким запустили CLI (`pnpm create` → pnpm). */
export function detectManager(env = process.env) {
  const agent = env.npm_config_user_agent ?? '';
  if (agent.startsWith('yarn')) return 'yarn';
  if (agent.startsWith('bun')) return 'bun';
  if (agent.startsWith('npm')) return 'npm';
  return 'pnpm';
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
export function installDeps(targetDir, manager = detectManager()) {
  try {
    execSync(`${manager} install`, { cwd: targetDir, stdio: 'inherit' });
    return true;
  } catch {
    log.warn(
      `Не вдалось встановити залежності — запусти «${manager} install».`,
    );
    return false;
  }
}

/** Наступні кроки — те саме, що в README згенерованого магазину. */
export function printNextSteps({ dirLabel, manager, installed, hasEnv }) {
  const steps = [`cd ${dirLabel}`];
  if (!installed) steps.push(`${manager} install`);
  if (!hasEnv)
    steps.push('cp .env.example .env.local   # ключі з Dashboard → Connect');
  steps.push('supabase link --project-ref <ref> && supabase db push');
  steps.push(
    'OWNER_EMAIL=you@example.com SUPABASE_SERVICE_ROLE_KEY=<key> ' +
      `${manager} run owner:invite`,
  );
  steps.push(`${manager} run dev`);
  note(steps.join('\n'), 'Наступні кроки');
  log.info(
    'Для хмарного проєкту продублюй supabase/templates/invite.html у\n' +
      'Dashboard → Authentication → Email Templates → «Invite user»:\n' +
      'стандартний лист не передає token_hash, і /auth/confirm його не побачить.',
  );
}
