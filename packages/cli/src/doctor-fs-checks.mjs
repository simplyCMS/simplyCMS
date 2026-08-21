// Файлові перевірки doctor №6–7 і №12 (§4.1): дрейф host-файлів,
// відставання міграцій, лінки агентних скілів. Самі порівняння живуть у
// host-drift.mjs, db-diff.mjs і skill-links.mjs — тут лише мапінг їхніх
// результатів на Check, щоб реалізація кожного була одна.
import { existsSync } from 'node:fs';
import {
  compareMigrationsMulti,
  pluginMigrationSources,
  storeMigrationsDir,
} from './db-diff.mjs';
import { findHostDrift } from './host-drift.mjs';
import { inspectSkillLinks } from './skill-links.mjs';

/** @typedef {import('./ui.mjs').Check} Check */

/**
 * №6: дрейф host-файлів магазину проти канону — теки host/ пакета CLI.
 * Порожній канон — стан «не вдалося перевірити», а не тихий пропуск.
 * @param {{ storeRoot: string; hostDir: string }} ctx
 * @returns {Check}
 */
export function checkHostDrift({ storeRoot, hostDir }) {
  const id = 'host-drift';
  const title = 'host-файли без дрейфу проти канону';
  const { files, drifted } = findHostDrift(storeRoot, hostDir);
  if (files.length === 0) {
    const details =
      'Канонічна тека host/ пакета CLI порожня — дрейф не перевірити';
    return { id, title, status: 'skip', details };
  }
  if (drifted.length > 0) {
    const details = `Розійшлися з каноном: ${drifted.join(', ')}. Онови: pnpm simplycms update --write`;
    return { id, title, status: 'warn', details };
  }
  return { id, title, status: 'ok' };
}

/**
 * №7: відставання міграцій магазину від канонів — simplycms/migrations
 * плюс міграції встановлених плагінів (N канонів, Фаза 3 Р4). `own`
 * рахується по обʼєднанню канонів — інакше скопійована міграція плагіна
 * брехливо значилась би «власною». Спільне імʼя з різним вмістом — error:
 * міграції immutable (§4.4 спеки).
 * @param {{ storeRoot: string; schemaMigrationsDir: string }} ctx
 * @returns {Check}
 */
export function checkMigrations({ storeRoot, schemaMigrationsDir }) {
  const id = 'migrations';
  const title = 'Міграції не відстають від канонів (ядро + плагіни)';
  if (!existsSync(schemaMigrationsDir)) {
    const details =
      'node_modules/simplycms/migrations відсутня — встановлене ядро ще не везе міграцій, онови його (pnpm simplycms update)';
    return { id, title, status: 'skip', details };
  }
  const sources = [
    { name: null, spec: 'simplycms', dir: schemaMigrationsDir },
    ...pluginMigrationSources(storeRoot),
  ];
  const { perSource, collisions } = compareMigrationsMulti(
    storeMigrationsDir(storeRoot),
    sources,
  );
  if (collisions.length > 0) {
    const details = `Колізія канонів (одне імʼя, різний вміст): ${collisions.join(', ')} — розберися вручну`;
    return { id, title, status: 'error', details };
  }
  const changed = perSource.flatMap((s) => s.changed);
  if (changed.length > 0) {
    const details = `Спільні міграції змінені локально: ${changed.join(', ')} — міграції immutable, розберися вручну`;
    return { id, title, status: 'error', details };
  }
  const missing = perSource.flatMap((s) => s.missing);
  if (missing.length > 0) {
    const details = `Нові міграції канонів: ${missing.join(', ')}. Забери: pnpm simplycms db:diff --write`;
    return { id, title, status: 'warn', details };
  }
  return { id, title, status: 'ok' };
}

/**
 * №12: лінки агентних скілів магазину на теку `skills/` пакета `simplycms`.
 * Ядро без `skills/` — skip (стара версія), а не помилка магазину. Осиротілі
 * й відсутні лінки — warn: лагодяться одним `simplycms update`, ламати
 * прогін через них нема за що.
 * @param {{ storeRoot: string }} ctx
 * @returns {Check}
 */
export function checkSkillLinks({ storeRoot }) {
  const id = 'skill-links';
  const title = 'Скіли ядра підключені до магазину';
  const { skills, missing, orphaned } = inspectSkillLinks(storeRoot);
  if (skills === null) {
    const details =
      'node_modules/simplycms/skills відсутня — ядро не встановлене або стара версія';
    return { id, title, status: 'skip', details };
  }
  const problems = [
    ...missing.map((link) => `немає лінка ${link}`),
    ...orphaned.map((link) => `осиротілий лінк ${link}`),
  ];
  if (problems.length > 0) {
    const details = `${problems.join('; ')}. Полагодь: pnpm simplycms update`;
    return { id, title, status: 'warn', details };
  }
  return { id, title, status: 'ok' };
}
