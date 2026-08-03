#!/usr/bin/env node

/**
 * Consumed-subpath аудит exports (Task 1.2).
 *
 * У монорепо workspace-аліаси (`tsconfig.json` paths, `vite.config.ts`
 * `resolve.alias`) резолвлять БУДЬ-ЯКИЙ subpath пакета напряму на файл у
 * `src/`/`routes/` — навіть той, якого немає в `package.json#exports`. При
 * справжньому `npm install` (tarball, без аліасів) Node різко впаде на
 * `ERR_PACKAGE_PATH_NOT_EXPORTED` для такого subpath-у. Цей скрипт зводить
 * докупи (а) усі реально вжиті специфікатори `@simplycms/<pkg>/<subpath>` і
 * (б) ключі `exports`/`publishConfig.exports` у manifest-і кожного пакета —
 * і друкує розриви.
 *
 * Мапа "імʼя пакета → тека" будується з поля `name` у `package.json`, НЕ з
 * імені теки: `@simplycms/plugins` живе в `plugin-system/`, `@simplycms/themes`
 * — у `theme-system/`.
 *
 * Використання:
 *   node scripts/audit-exports.mjs           # CLI: список розривів, exit 1 якщо є
 *   import { runAudit } from './audit-exports.mjs'   # програмний виклик (тест-гейт)
 */

import {
  collectPackages,
  collectSpecifiers,
} from './audit-exports/collect.mjs';
import { resolveExportKey } from './audit-exports/resolve.mjs';

/**
 * Прогонити повний аудит.
 * @returns {{
 *   scanned: number;
 *   missing: { specifier: string; pkg: string; reason: string; packageJsonPath: string }[];
 *   unresolved: string[];
 * }}
 */
export function runAudit() {
  const packages = collectPackages();
  const specifiers = collectSpecifiers();

  const missing = [];
  const unresolved = [];

  for (const specifier of specifiers) {
    const match = /^@simplycms\/([a-zA-Z0-9_-]+)\/(.+)$/.exec(specifier);
    if (!match) continue;
    const [, pkgSegment, subpath] = match;
    const pkgName = `@simplycms/${pkgSegment}`;
    const info = packages.get(pkgName);

    if (!info) {
      // Не workspace-пакет (напр. `@simplycms/db-types` — чистий tsconfig-
      // аліас на файл, без package.json#exports) — поза скоупом цього аудиту.
      unresolved.push(specifier);
      continue;
    }

    const devKey = resolveExportKey(info.exportsKeys, subpath);
    if (!devKey) {
      missing.push({
        specifier,
        pkg: pkgName,
        reason: 'exports',
        packageJsonPath: info.packageJsonPath,
      });
      continue;
    }

    if (info.publishExportsKeys) {
      const pubKey = resolveExportKey(info.publishExportsKeys, subpath);
      if (!pubKey) {
        missing.push({
          specifier,
          pkg: pkgName,
          reason: 'publishConfig.exports',
          packageJsonPath: info.packageJsonPath,
        });
      }
    }
  }

  return { scanned: specifiers.length, missing, unresolved };
}

// ── CLI ──────────────────────────────────────────────────────────────────
const isMain =
  process.argv[1] && import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  const { scanned, missing, unresolved } = runAudit();

  console.log(
    `[audit-exports] Проскановано ${scanned} унікальних специфікаторів @simplycms/<pkg>/<subpath>.`,
  );

  if (unresolved.length > 0) {
    console.log(
      `\n⚪ Поза скоупом (не workspace-пакет, напр. tsconfig-only аліас): ${unresolved.length}`,
    );
    for (const s of unresolved) console.log(`  ${s}`);
  }

  if (missing.length === 0) {
    console.log('\n✅ 0 відсутніх exports.');
    process.exit(0);
  }

  console.log(`\n❌ ${missing.length} відсутніх exports:`);
  for (const m of missing) {
    console.log(
      `  ${m.specifier} — немає ключа в ${m.reason} (${m.packageJsonPath})`,
    );
  }
  process.exit(1);
}
