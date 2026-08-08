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
 * Джерело правди — `pnpm-lock.yaml` скретча, секція `packages:`: вона
 * перелічує ВЕСЬ граф, включно з транзитивними, тож покриває саме той випадок,
 * заради якого overrides і потрібні.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Специфікатор локального tarball-а у формі, якою його пише pnpm. */
const LOCAL = 'file:';

/**
 * Зібрати пакети ядра із секції `packages:` lockfile-а.
 *
 * 🔴 Саме `packages:`, а не `snapshots:`: обидві секції повторюють ті самі
 * ключі, тож рахувати треба одну — інакше кожен пакет подвоївся б.
 *
 * 🔴 Ключ розбирається збігом за ВІДОМИМ іменем (`<name>@`), а не пошуком
 * роздільника. Ключі pnpm 9 несуть суфікс peer-залежностей, іноді вкладений
 * (`'@babel/x@7.29.7(@babel/core@7.29.7(supports-color@7.2.0))'`), а
 * `file:`-специфікатор — довільний шлях; будь-яка евристика на `indexOf`/
 * `lastIndexOf` ламається на одному з цих двох випадків. Перелік імен у нас і
 * так є (усе, що спакував `packAll`), тож здогадуватись не треба.
 *
 * @param {string} source вміст `pnpm-lock.yaml`
 * @param {string[]} coreNames імена пакетів ядра (вони ж — джерело scope-ів)
 * @returns {{ entries: Map<string,string>, fromRegistry: string[], unknown: string[] }}
 *   `entries` — імʼя → специфікатор; `fromRegistry` — ПОВНІ ключі тих, що
 *   приїхали не з tarball-а; `unknown` — пакети зі scope ядра, яких немає
 *   серед спакованих (нове імʼя, про яке пілот не знає).
 */
export function parseCorePackages(source, coreNames) {
  const scopes = [
    ...new Set(coreNames.map((n) => n.slice(0, n.indexOf('/') + 1))),
  ].filter(Boolean);

  const lines = source.split('\n');
  const start = lines.findIndex((line) => line === 'packages:');
  const entries = new Map();
  const fromRegistry = [];
  const unknown = [];
  if (start < 0) return { entries, fromRegistry, unknown };

  for (const line of lines.slice(start + 1)) {
    // Наступна секція верхнього рівня (`snapshots:`) завершує перебір.
    if (/^\S/.test(line)) break;
    const match = /^ {2}'?(.+?)'?:$/.exec(line);
    if (!match) continue;

    const key = match[1];
    if (!scopes.some((scope) => key.startsWith(scope))) continue;

    const name = coreNames.find((candidate) => key.startsWith(`${candidate}@`));
    if (!name) {
      unknown.push(key);
      continue;
    }

    const spec = key.slice(name.length + 1);
    entries.set(name, spec);
    if (!spec.startsWith(LOCAL)) fromRegistry.push(key);
  }

  return { entries, fromRegistry, unknown };
}

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
