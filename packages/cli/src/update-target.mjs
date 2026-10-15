// Вибір цільової версії для `simplycms update`: dist-tags реєстру, канал
// пре-релізу і межа сумісності (мажорна з 1.0, мінорна для 0.x). Усе, що ходить у мережу, — через ін'єкційний
// `exec` (див. `run(argv, deps)` в update.mjs), тож тести підставляють фейк.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  compareVersions,
  isPrereleaseVersion,
  compatBoundaryOf,
  parseVersion,
} from './versions.mjs';

const TO_HINT = 'Задай її явно: simplycms update --to <version>';

/**
 * `pnpm view @simplycms/cli dist-tags --json` → `{ latest, next }`. Недоступний
 * реєстр чи порожня відповідь — гучне падіння з підказкою `--to`, не «остання
 * відома».
 * @param {(command: string, args: string[], options?: object) => unknown} exec
 * @returns {{ latest?: string; next?: string }}
 */
export function fetchDistTags(exec) {
  let raw;
  try {
    raw = exec('pnpm', ['view', '@simplycms/cli', 'dist-tags', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (cause) {
    throw new Error(
      `Реєстр недоступний — цільову версію не зʼясувати. ${TO_HINT}`,
      {
        cause,
      },
    );
  }
  let tags;
  try {
    tags = JSON.parse(String(raw));
  } catch (cause) {
    throw new Error(`Реєстр повернув не-JSON dist-tags. ${TO_HINT}`, { cause });
  }
  const pick = (name) =>
    typeof tags?.[name] === 'string' && parseVersion(tags[name])
      ? tags[name]
      : undefined;
  const result = { latest: pick('latest'), next: pick('next') };
  if (!result.latest && !result.next)
    throw new Error(`Реєстр не повернув версій @simplycms/cli. ${TO_HINT}`);
  return result;
}

/**
 * Версія ядра, що зараз стоїть у магазині: встановлений `simplycms`, а за його
 * відсутності (до install) — точний пін із package.json. Невідомо → null.
 * @param {string} storeRoot
 * @param {{ dependencies?: Record<string, string> }} manifest
 */
export function readInstalledCoreVersion(storeRoot, manifest) {
  const installed = join(
    storeRoot,
    'node_modules',
    'simplycms',
    'package.json',
  );
  if (existsSync(installed)) {
    try {
      const version = JSON.parse(readFileSync(installed, 'utf8')).version;
      if (parseVersion(version)) return version;
    } catch {
      // бите встановлення — падаємо на пін із package.json
    }
  }
  const pin = manifest.dependencies?.simplycms;
  return pin && parseVersion(pin) ? pin : null;
}

/**
 * Без `--to`: магазин на пре-релізі стежить за `max(next, latest)` (щоб
 * `1.0.0` після RC теж підхопився), стабільний — лише за `latest`.
 * @param {{ latest?: string; next?: string }} tags
 * @param {string | null} current
 */
export function pickTargetVersion(tags, current) {
  if (current && isPrereleaseVersion(current)) {
    const candidates = [tags.latest, tags.next].filter(Boolean);
    return candidates.reduce((best, v) =>
      compareVersions(v, best) > 0 ? v : best,
    );
  }
  if (!tags.latest)
    throw new Error(
      `У реєстрі немає стабільного релізу (dist-tag latest). ${TO_HINT}`,
    );
  return tags.latest;
}

/**
 * Цільова версія й що з нею робити:
 * - `--to X` — як є, без перевірок (явне рішення власника);
 * - `up-to-date` — ціль не новіша за поточну: нічого не ставимо (даунгрейд
 *   лише явним `--to`);
 * - `boundary` — ціль перетинає межу сумісності (мажорну з 1.0, мінорну для 0.x):
 *   чесний semver, тож без `--to` злам не ставимо (RC → фінальний тієї ж межі
 *   її не перетинає);
 * - `unknown` — поточна версія невідома: без `--to` не ставимо;
 * - `install` — ставимо.
 * @param {string | undefined} to
 * @param {{ exec: Function; current: string | null }} ctx
 * @returns {{ version: string; status: 'install' | 'up-to-date' | 'boundary' | 'unknown' }}
 */
export function resolveUpdateTarget(to, { exec, current }) {
  if (to) return { version: to, status: 'install' };
  const version = pickTargetVersion(fetchDistTags(exec), current);
  // Без відомої поточної версії не можна ні відрізнити даунгрейд, ні межу сумісності
  // : мовчки ставити latest значить ризикнути обома — просимо явний --to.
  if (!current) return { version, status: 'unknown' };
  if (compareVersions(version, current) <= 0)
    return { version, status: 'up-to-date' };
  if (compatBoundaryOf(version) !== compatBoundaryOf(current))
    return { version, status: 'boundary' };
  return { version, status: 'install' };
}

/** Версія, з якої магазин має журнал міграцій (`simplycms_migrations`). */
const JOURNAL_SINCE = '0.15.0';

/**
 * Чи доведеться створити базу заново: база магазину до 0.15.0 не має журналу
 * міграцій, і контейнер 0.15.0+ відмовляє їй (`UnjournaledDatabaseError`) —
 * адопції немає за рішенням, тож це зламана зміна, а не тихий апгрейд.
 * @param {string} current
 * @param {string} target
 */
export function needsDatabaseRecreation(current, target) {
  return (
    compareVersions(current, JOURNAL_SINCE) < 0 &&
    compareVersions(target, JOURNAL_SINCE) >= 0
  );
}

/** Попередження про базу без журналу: дія, а не лише факт (див. BREAKING у CHANGELOG). */
export const DATABASE_RECREATION_NOTE =
  'База 0.14 (без журналу міграцій) не підніметься на 0.15+: контейнер упаде з ' +
  '`UnjournaledDatabaseError`. Створи базу заново: локально — порожня БД і ' +
  '`pnpm simplycms db:apply`, на сервері — новий порожній екземпляр БД; ' +
  'деталі — розділ BREAKING у CHANGELOG.';
