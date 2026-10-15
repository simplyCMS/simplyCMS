// Р21: передача керування НОВОМУ CLI магазину після `pnpm add` старим. Окремий
// модуль: update.mjs лишається про вибір версії й install.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { say } from './ui.mjs';

/** Маркер дочірнього процесу після install: новий CLI не ставить пакети вдруге (Р21). */
export const AFTER_INSTALL = '--after-install';

/**
 * Точка входу встановленого CLI магазину — з `bin` (рядок або `bin.simplycms`), а не
 * зашитий `src/index.mjs`: розкладка пакета може змінитись. Пакети на цей момент уже
 * поставлено, тож відмова пояснює, як дійти до звірки без повторного install.
 */
function newCliEntry(storeRoot) {
  const cliDir = join(storeRoot, 'node_modules', '@simplycms', 'cli');
  const fail = (why) =>
    new Error(
      `${why}. Пакети ядра вже встановлено — звір магазин: pnpm simplycms update --no-install ` +
        '(якщо @simplycms/cli немає в devDependencies магазину — додай: pnpm add -D @simplycms/cli)',
    );
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(cliDir, 'package.json'), 'utf8'));
  } catch {
    throw fail(`Не вдалося прочитати ${cliDir}/package.json`);
  }
  const bin =
    typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.simplycms;
  if (typeof bin !== 'string')
    throw fail(`У ${cliDir}/package.json немає bin.simplycms`);
  return join(cliDir, bin);
}

/**
 * Р21: після `pnpm add` цей процес — СТАРИЙ CLI з каноном host/ своєї версії (Node
 * резолвить реальний шлях у `.pnpm/@simplycms+cli@<стара>`, і pnpm теку не прибирає).
 * Звірка тут дала б хибне «збігаються з каноном», тож перевірку й запис робить НОВИЙ
 * CLI магазину; маркер не дає йому ставити пакети вдруге. Код виходу — його.
 */
export function handOver(storeRoot, argv, exec) {
  const entry = newCliEntry(storeRoot);
  say.step('Пакети встановлено — звірку й запис веде нова версія CLI.');
  const options = { cwd: storeRoot, stdio: 'inherit' };
  try {
    exec(process.execPath, [entry, 'update', AFTER_INSTALL, ...argv], options);
  } catch (error) {
    if (typeof error?.status !== 'number') throw error;
    process.exitCode = error.status;
  }
}
