// Файлові перевірки doctor №6–7 (§4.1): дрейф host-файлів і відставання
// міграцій. Самі порівняння живуть у host-drift.mjs і db-diff.mjs — тут лише
// мапінг їхніх результатів на Check, щоб реалізація кожного була одна.
import { existsSync } from 'node:fs';
import {
  compareMigrationsMulti,
  pluginMigrationSources,
  storeMigrationsDir,
} from './db-diff.mjs';
import { findHostDrift } from './host-drift.mjs';

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
 * №7: відставання міграцій магазину від канонів — @simplycms/schema/migrations
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
      'node_modules/@simplycms/schema/migrations відсутня — встановлене ядро ще не везе міграцій, онови @simplycms/schema';
    return { id, title, status: 'skip', details };
  }
  const sources = [
    { name: null, spec: '@simplycms/schema', dir: schemaMigrationsDir },
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
