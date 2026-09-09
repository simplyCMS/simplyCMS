// Дрейф host-файлів магазину проти канону — теки host/ пакета CLI (§4.3
// спеки): байт-копій SYNCED_FILES монорепо, синхронізованих `pnpm
// template:sync`. Тека сама собі маніфест: множину файлів визначає
// рекурсивний обхід, дубльованого списку немає. Єдина реалізація порівняння —
// її споживають і `update`, і doctor (перевірка №6), і db:diff (байт-компаратор).
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Канонічна тека host/ цього пакета (сусідка src/ і в репо, і в tarball). */
export const CANON_HOST_DIR = fileURLToPath(
  new URL('../host', import.meta.url),
);

/** Рекурсивний обхід теки: відносні шляхи без маркера .gitkeep. */
function walk(dir, base) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(path, base));
    else if (entry.name !== '.gitkeep') files.push(relative(base, path));
  }
  return files;
}

/** Перелік файлів теки — відносні шляхи, відсортовані. Відсутня тека → []. */
export function listFiles(dir) {
  if (!existsSync(dir)) return [];
  return walk(dir, dir).sort();
}

/** Байт-порівняння канон↔локальний; відсутність локального — теж розходження. */
export const fileDiffers = (canonPath, localPath) =>
  !existsSync(localPath) ||
  !readFileSync(localPath).equals(readFileSync(canonPath));

/**
 * Дрейф магазину проти канону. `files` — повний склад канону (порожній =
 * канон відсутній, рішення про skip чи гучне падіння — за викликачем);
 * `drifted` — файли, що розійшлися чи відсутні в магазині.
 * @param {string} storeRoot
 * @param {string} [hostDir]
 * @returns {{ files: string[]; drifted: string[] }}
 */
export function findHostDrift(storeRoot, hostDir = CANON_HOST_DIR) {
  const files = listFiles(hostDir);
  const drifted = files.filter((file) =>
    fileDiffers(join(hostDir, file), join(storeRoot, file)),
  );
  return { files, drifted };
}

/**
 * Перезаписати названі файли магазину канонічними версіями (update --write).
 * @param {string} storeRoot
 * @param {string[]} files
 * @param {string} [hostDir]
 */
export function writeHostFiles(storeRoot, files, hostDir = CANON_HOST_DIR) {
  for (const file of files) {
    const target = join(storeRoot, file);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(hostDir, file), target);
  }
}
