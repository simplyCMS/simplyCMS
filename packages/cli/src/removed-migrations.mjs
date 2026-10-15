// Файли, ПРИБРАНІ з канону ядра (`simplycms/migrations/removed.json`).
// `db:diff --write` лише докопіює нове — сам він не видалив би файл, якого в
// каноні більше немає, а магазин тримав би його поряд із baseline, що вже
// містить ту саму таблицю (накат падає на CREATE TABLE вдруге).
//
// 🔴 Маніфест ЗАКРИТИЙ: видаляється лише файл із точним імʼям І точним sha256.
// Евристику за іменем (`^\d{4}_….sql` = «міграція ядра») свідомо не беремо:
// власник магазину міг назвати власну міграцію `0006_x.sql`, і конвенція імені
// не відрізнила б її від файлу ядра.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { say } from './ui.mjs';

/** Імʼя файлу маніфесту поруч із міграціями ядра (їде в tarball `simplycms`). */
export const REMOVED_MANIFEST_FILE = 'removed.json';

// Лише імʼя файлу ЯДРА без шляху: `..`/`/` дали б вихід з db/migrations під
// `rmSync`, а плагінні `<14 цифр>_plg_*` у маніфесті ядра сенсу не мають.
const CORE_FILE_NAME = /^\d{4}_[a-z0-9_]+\.sql$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * @typedef {{ name: string; sha256: string; removedIn: string; reason: string }} RemovedEntry
 * @typedef {{ name: string; status: 'match' | 'modified' }} RemovedFinding
 */

function assertEntry(entry, index, path) {
  const where = `${path}, запис №${index + 1}`;
  if (typeof entry !== 'object' || entry === null)
    throw new Error(`${where}: очікувався обʼєкт.`);
  if (!CORE_FILE_NAME.test(entry.name ?? ''))
    throw new Error(
      `${where}: імʼя '${entry.name}' не є файлом міграції ядра (NNNN_імʼя.sql без шляху).`,
    );
  if (!SHA256_HEX.test(entry.sha256 ?? ''))
    throw new Error(
      `${where}: sha256 має бути 64 hex-символами нижнього регістру.`,
    );
  for (const field of ['removedIn', 'reason'])
    if (typeof entry[field] !== 'string' || entry[field] === '')
      throw new Error(`${where}: порожнє поле ${field}.`);
}

/**
 * Маніфест встановленого ядра. Файла немає (стара версія ядра) — порожній
 * перелік: нічого не відомо про видалене, тож нічого й не чіпаємо. Зіпсований
 * маніфест — гучна помилка до будь-якого запису.
 * @param {string} coreDir тека `migrations/` встановленого ядра
 * @returns {RemovedEntry[]}
 */
export function readRemovedManifest(coreDir) {
  const path = join(coreDir, REMOVED_MANIFEST_FILE);
  if (!existsSync(path)) return [];
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`${path}: не валідний JSON (${error.message}).`);
  }
  if (!Array.isArray(parsed))
    throw new Error(`${path}: очікувався масив записів.`);
  parsed.forEach((entry, index) => assertEntry(entry, index, path));
  return parsed;
}

/**
 * sha256 вмісту з нормалізованими кінцями рядків: той самий файл, витягнутий
 * git-ом на Windows із `\r\n`, не повинен ставати «зміненим» (так само
 * нормалізує суму журналу міграцій у ядрі — `readMigrationSql`).
 */
function contentHash(path) {
  const text = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Які файли з маніфесту лежать у `db/migrations` магазину. Розглядаються ЛИШЕ
 * імена з маніфесту; усе інше (власні, плагінні) не читається взагалі.
 * @param {string} storeDir
 * @param {RemovedEntry[]} manifest
 * @returns {RemovedFinding[]}
 */
export function findRemovedCoreMigrations(storeDir, manifest) {
  const found = [];
  for (const { name, sha256 } of manifest) {
    const path = join(storeDir, name);
    if (!existsSync(path) || !statSync(path).isFile()) continue;
    found.push({
      name,
      status: contentHash(path) === sha256 ? 'match' : 'modified',
    });
  }
  return found;
}

/**
 * Повідомлення про один знайдений файл — спільне для `db:diff` і doctor.
 * @param {RemovedEntry} entry
 * @param {'match' | 'modified'} status
 */
export function removedNotice({ name, removedIn, reason }, status) {
  const head = `Файл ${name} прибрано з канону ядра у ${removedIn}`;
  return status === 'match'
    ? `${head}; причина: ${reason}. У магазині він збігається з відомою версією — забери: pnpm simplycms db:diff --write`
    : `${head}, але в магазині він змінений (хеш інший) — перенеси свої зміни в нову міграцію й видали файл вручну`;
}

/**
 * Звіт і (з `write`) прибирання. Видаляється лише `match`; `modified` —
 * відмова: чужі правки не губимо.
 * @param {{ storeDir: string; manifest: RemovedEntry[]; found: RemovedFinding[]; write: boolean }} args
 * @returns {{ removed: string[]; refused: string[] }}
 */
export function applyRemovedCore({ storeDir, manifest, found, write }) {
  const removed = [];
  const refused = [];
  for (const { name, status } of found) {
    const entry = manifest.find((e) => e.name === name);
    if (status === 'modified') {
      refused.push(name);
      const text = removedNotice(entry, status);
      if (write) say.error(text);
      else say.warn(text);
    } else if (write) {
      rmSync(join(storeDir, name));
      removed.push(name);
      say.success(
        `Видалено ${name}: прибрано з канону ядра у ${entry.removedIn}; причина: ${entry.reason}.`,
      );
    } else {
      say.warn(removedNotice(entry, status));
    }
  }
  return { removed, refused };
}
