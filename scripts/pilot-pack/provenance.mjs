/**
 * Гард провенансу: чи справді скретч поставив ЛОКАЛЬНІ tarball-и.
 *
 * 🔴 Навіщо окрема перевірка, якщо є гейти. Механізм примусу tarball-ів —
 * `overrides` у `pnpm-workspace.yaml` скретча. Помилка в ньому під pnpm
 * МОВЧАЗНА: npm-івську форму (`overrides` у package.json) pnpm ігнорує без
 * жодного попередження. Раніше це було не страшно — пакетів `@simplycms/*` у
 * реєстрі не існувало, тож install падав `ERR_PNPM_FETCH_404`. Тепер у реєстрі
 * лежить ТА САМА версія, що й у tarball-ах, тож зламаний механізм дасть
 * ЗЕЛЕНИЙ пілот, який перевірив уже опубліковані пакети замість тих, що
 * тільки йдуть на публікацію. Гейти A/C/D цього не бачать — вони дивляться на
 * зібраний магазин, а не на походження його залежностей.
 *
 * Джерело правди — `pnpm-lock.yaml` скретча; його розбирає `lockfile-scan.mjs`.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCorePackages } from './lockfile-scan.mjs';

/**
 * Довести, що пакети ядра у скретчі прийшли з локальних tarball-ів.
 *
 * @param {string} storeDir тека скретч-магазину
 * @param {string[]} tarballNames імена пакетів, спакованих у tarball-и
 * @returns {{ ok: boolean; details: string[] }}
 */
export function assertTarballProvenance(storeDir, tarballNames) {
  const details = [];
  const lockPath = join(storeDir, 'pnpm-lock.yaml');
  if (!existsSync(lockPath)) {
    return {
      ok: false,
      details: ['FAIL немає pnpm-lock.yaml — install не дійшов'],
    };
  }

  const manifest = JSON.parse(
    readFileSync(join(storeDir, 'package.json'), 'utf8'),
  );
  const known = new Set(tarballNames);
  const declared = Object.keys(manifest.dependencies ?? {}).filter((name) =>
    known.has(name),
  );

  // Без цієї перевірки гард зеленів би на магазині, який ядра взагалі не
  // оголошує, — тобто доводив би порожнечу.
  if (declared.length === 0) {
    return {
      ok: false,
      details: ['FAIL манифест скретча не оголошує жодного пакета ядра'],
    };
  }

  const { entries, fromRegistry, unknown } = parseCorePackages(
    readFileSync(lockPath, 'utf8'),
    tarballNames,
  );
  const missing = declared.filter((name) => !entries.has(name));

  details.push(
    `пакетів ядра у lockfile: ${entries.size}, оголошено в манифесті: ${declared.length}`,
  );
  if (missing.length) {
    details.push(`FAIL немає в lockfile: ${missing.join(', ')}`);
  }
  if (fromRegistry.length) {
    details.push(
      `FAIL приїхали НЕ з tarball-а (overrides не спрацювали): ${fromRegistry.join(', ')}`,
    );
  }
  if (unknown.length) {
    details.push(
      `FAIL пакет ядра поза переліком спакованих: ${unknown.join(', ')}`,
    );
  }
  const failed = missing.length + fromRegistry.length + unknown.length;
  if (failed === 0) {
    details.push(
      `OK   усі ${entries.size} пакетів ядра — з локальних tarball-ів`,
    );
  }

  return { ok: failed === 0, details };
}
