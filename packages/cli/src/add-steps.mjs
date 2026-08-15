// Блок «наступні кроки» команди add. Винесено з add.mjs заради ліміту рядків:
// сам сценарій там, а тут — те, що залежить від типу встановленого пакета.
import { join } from 'node:path';

/** Спільний крок: конфіг — build-time, без перезбірки нічого не зміниться. */
const REBUILD = 'pnpm build   # конфіг — build-time, без rebuild змін не буде';

/** Тема мало встановити — її ще треба зробити активною (рядок у БД + is_active). */
const ACTIVATE =
  '/admin/themes   # активуй тему в адмінці (рядок заводить bootstrapThemes)';

/** Кроки для теми — однакові для обох гілок установки (npm і `--copy`). */
export const themeSteps = () => [REBUILD, ACTIVATE];

/**
 * @param {{ storeRoot: string; pkg: string; type: 'plugin' | 'theme' }} input
 * @returns {Promise<string[]>}
 */
export async function addSteps({ storeRoot, pkg, type }) {
  if (type === 'theme') return themeSteps();
  const steps = [REBUILD];
  // Реальний dry-run конвеєра міграцій (Фаза 3): дивимось, що плагін привіз у
  // migrations/ свого пакета, і скільки з того магазин ще не має.
  const { listSqlFiles, storeMigrationsDir } = await import('./db-diff.mjs');
  const store = listSqlFiles(storeMigrationsDir(storeRoot));
  const missing = listSqlFiles(
    join(storeRoot, 'node_modules', pkg, 'migrations'),
  ).filter((name) => !store.includes(name));
  if (missing.length > 0) {
    steps.push(
      `pnpm simplycms db:diff --write   # плагін привіз ${missing.length} міграцій — ревʼю + supabase db push`,
    );
  }
  return steps;
}
