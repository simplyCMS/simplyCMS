// Ребазлайн магазину: `simplycms db:diff --write --rebaseline`.
// До `1.0.0-rc.1` baseline `0000…0004` правлять як виняток (кожен реліз з такою
// правкою — «перестворити БД»), тож файли ядра в `db/migrations` магазину
// розходяться з каноном вмістом. Без цього режиму `db:diff` зупинявся на
// «Спільні міграції розійшлися вмістом», а шляху «оновити baseline-файли
// магазину» в платформі не було. Режим заміняє вмістом канону лише файли ЯДРА,
// що є в каноні й відрізняються; власні та плагінні не розглядаються (їх немає
// серед `changed` ядра за побудовою компаратора).
//
// БД режим не чіпає: гарантію, що змінений вміст не накотиться поверх старого,
// дає sha256-журнал `simplycms_migrations` (Е8) — тому перелік заміни завжди
// супроводжується вимогою перестворити базу.
import { cpSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { removedNotices } from './removed-migrations.mjs';
import { finish, say } from './ui.mjs';
import { compareVersions } from './versions.mjs';

/** Команда ребазлайну — одним рядком для підказок і кроків. */
export const REBASELINE_COMMAND = 'simplycms db:diff --write --rebaseline';

/**
 * Версія встановленого ядра: `package.json` поруч з його `migrations/`.
 * @param {string} coreMigrationsDir `node_modules/simplycms/migrations`
 * @returns {string | null}
 */
function installedCoreVersion(coreMigrationsDir) {
  const path = join(coreMigrationsDir, '..', 'package.json');
  if (!existsSync(path)) return null;
  try {
    const { version } = JSON.parse(readFileSync(path, 'utf8'));
    return typeof version === 'string' ? version : null;
  } catch {
    return null;
  }
}

/**
 * Причина відмови ребазлайну або `null`. Канон заморожується кроком релізу
 * `1.0.0-rc.1`, тож перевірка — за версією ВСТАНОВЛЕНОГО ядра (semver, пререліз
 * `1.0.0-rc.1` уже заморожений), а не за прапорцем у коді. Версію не визначено
 * — відмова: довести, що канон ще не заморожено, не вдалося.
 * @param {string} coreMigrationsDir
 * @returns {string | null}
 */
export function rebaselineRefusal(coreMigrationsDir) {
  const version = installedCoreVersion(coreMigrationsDir);
  const unknown =
    'Ребазлайн не виконано: не вдалося визначити версію встановленого ядра ' +
    '(node_modules/simplycms/package.json) — без неї не довести, що канон ще не заморожено.';
  if (version === null) return unknown;
  let frozen;
  try {
    frozen = compareVersions(version, '1.0.0-rc.1') >= 0;
  } catch {
    // Версія не `X.Y.Z[-rc.N]` — порівняти нема з чим.
    return unknown;
  }
  return frozen
    ? `Ребазлайн відмовлено: канон заморожено — встановлене ядро ${version} ≥ 1.0.0-rc.1, baseline більше не правиться. Зміни схеми приходять новими файлами (simplycms db:diff --write).`
    : null;
}

/**
 * Підказка до зупинки «Спільні міграції розійшлися вмістом»; порожня, коли
 * ребазлайн недоступний (канон заморожено, версія невідома) — радити його було б
 * брехнею.
 * @param {string} coreMigrationsDir
 */
export function rebaselineHint(coreMigrationsDir) {
  return rebaselineRefusal(coreMigrationsDir) === null
    ? `До 1.0.0-rc.1 це baseline-виняток: ${REBASELINE_COMMAND} + перестворити БД.`
    : '';
}

/**
 * Перелік файлів, що замінюються вмістом канону, і червоний рядок про базу.
 * @param {string[]} names
 * @param {boolean} write
 */
export function reportReplacement(names, write) {
  const verb = write
    ? 'замінюю вмістом канону'
    : 'буде замінено вмістом канону (--write)';
  say.warn(
    `Файли ядра змінено baseline-винятком — ${verb} (локальні правки в цих файлах буде втрачено): ${names.join(', ')}`,
  );
  say.error(
    'Увага — базу даних треба перестворити: журнал накату `simplycms_migrations` відхилить змінений вміст.',
  );
}

/**
 * Відмова ребазлайну (канон заморожено / версію ядра не визначено): друк, код 1,
 * фінальний підпис. `true` — прохід треба зупинити до будь-якого читання чи запису.
 * @param {string} coreMigrationsDir
 */
export function refuseRebaseline(coreMigrationsDir) {
  const refusal = rebaselineRefusal(coreMigrationsDir);
  if (!refusal) return false;
  say.error(refusal);
  process.exitCode = 1;
  finish('Ребазлайн недоступний.');
  return true;
}

/**
 * Порада до зупинки «Спільні міграції розійшлися вмістом». Ребазлайн радимо лише
 * коли він справді пройде: змінені ЛИШЕ файли ядра (змінений файл плагіна зупинив
 * би й `--rebaseline`) і режим ще доступний (канон не заморожено). Інакше поради
 * немає, а `fix = null` — файли з маніфесту теж не дістануть команди, що знову
 * впаде на тому самому конфлікті.
 * @param {{ changed: string[]; coreChanged: string[]; rebaseline: boolean; coreDir: string }} args
 * @returns {{ hint: string; fix: string | null }}
 */
export function conflictAdvice({ changed, coreChanged, rebaseline, coreDir }) {
  const usable =
    !rebaseline &&
    coreChanged.length > 0 &&
    changed.length === coreChanged.length;
  const hint = usable ? rebaselineHint(coreDir) : '';
  return { hint, fix: hint ? `pnpm ${REBASELINE_COMMAND}` : null };
}

/**
 * Зупинка «Спільні міграції розійшлися вмістом»: текст із порадою (`conflictAdvice`)
 * і файлами з маніфесту `removed.json`, щоб власник бачив усе за один прогін.
 * @param {{
 *   changed: string[]; coreChanged: string[]; rebaseline: boolean; coreDir: string;
 *   manifest: import('./removed-migrations.mjs').RemovedEntry[];
 *   removed: import('./removed-migrations.mjs').RemovedFinding[];
 * }} args
 */
export function reportContentConflict(args) {
  const { changed, manifest, removed } = args;
  const { hint, fix } = conflictAdvice(args);
  say.error(
    [
      `Спільні міграції розійшлися вмістом: ${changed.join(', ')}.`,
      'Міграції immutable — нічого не записано, розберися вручну.',
      hint,
    ]
      .filter(Boolean)
      .join('\n'),
  );
  for (const text of removedNotices(manifest, removed, fix)) say.warn(text);
}

/**
 * Заміна файлів ядра вмістом канону: перелік і червоний рядок — до заміни;
 * без `write` — лише звіт.
 * @param {{ storeDir: string; coreDir: string; names: string[]; write: boolean }} args
 */
export function applyReplacement({ storeDir, coreDir, names, write }) {
  reportReplacement(names, write);
  if (!write) return;
  for (const name of names) cpSync(join(coreDir, name), join(storeDir, name));
  say.success(`Замінено вмістом канону (${names.length}): ${names.join(', ')}`);
}

/**
 * Наступні кроки після `--write`. Відмова по зміненому файлу з маніфесту не
 * «готово»: ручне видалення, і лише тоді (за потреби) нова база та накат.
 * @param {{ replaced: number; refused: string[] }} args
 * @returns {string[]}
 */
export function writeSteps({ replaced, refused }) {
  return [
    refused.length > 0
      ? `видали вручну ${refused.join(', ')}   # попередньо перенеси свої зміни в нову міграцію`
      : 'git diff                        # ревʼю доданих, замінених і прибраних міграцій',
    ...(replaced > 0
      ? [
          'перестворити базу даних         # порожня БД (локально) або новий екземпляр (сервер)',
        ]
      : []),
    'pnpm simplycms db:apply         # накат (MIGRATION_DATABASE_URL — власник схеми)',
  ];
}
