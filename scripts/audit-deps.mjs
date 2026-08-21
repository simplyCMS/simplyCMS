#!/usr/bin/env node

/**
 * Deps-graph аудит manifest-ів (Task 1.3).
 *
 * У монорепо будь-який bare-імпорт резолвиться через workspace-аліаси
 * (`tsconfig.json` paths, `vite.config.ts` `resolve.alias`) і через
 * hoisted-корінь `node_modules` — навіть якщо пакет НЕ оголосив цю
 * залежність у своєму `package.json`. При справжньому `pnpm install`
 * з tarball-а (Етап 3, пілот) така недекларована залежність просто не
 * встановиться → `ERR_MODULE_NOT_FOUND` у споживача.
 *
 * Скрипт для КОЖНОГО пакета `packages/*`:
 *   1) сканує ВСІ publish-root-и — `src/`, `routes/` (route-пакети везуть
 *      `routes/` сирцями) і `skills/` (скіли виконуються з
 *      `node_modules/simplycms/`); список — `PUBLISH_ROOTS` у collect.mjs;
 *   2) збирає ВСІ bare-імпорти — і сиблінги `@simplycms/*`, і зовнішні
 *      (`@tanstack/*`, `@tiptap/*`, `lucide-react`, `zod`, `@supabase/*`, …);
 *   3) нормалізує subpath до імені пакета, відкидає `node:*`/вбудовані;
 *   4) перевіряє: множина bare-імпортів ⊆ (dependencies ∪ peerDependencies).
 *
 * Використання:
 *   node scripts/audit-deps.mjs                     # CLI: розриви, exit 1
 *   import { runAudit } from './audit-deps.mjs'     # тест-гейт
 */

import {
  classifyExternal,
  collectDeclaredPeers,
  proposeRange,
  toPackageName,
} from './audit-deps/classify.mjs';
import {
  PUBLISH_ROOTS,
  collectImports,
  collectPackages,
  collectRootVersions,
} from './audit-deps/collect.mjs';

/**
 * @typedef {{
 *   pkg: string;
 *   dependency: string;
 *   field: 'dependencies' | 'peerDependencies';
 *   version: string | null;
 *   files: string[];
 *   packageJsonPath: string;
 * }} Gap
 */

/**
 * Прогонити повний аудит.
 * @returns {{ scanned: number; packages: number; missing: Gap[] }}
 */
export function runAudit() {
  const packages = collectPackages();
  const rootVersions = collectRootVersions();
  const declaredPeers = collectDeclaredPeers(packages);

  /** @type {Map<string, Gap>} ключ `pkg\0dependency` — різні subpath-и одного
   * пакета (`date-fns` і `date-fns/locale`) дають ОДИН розрив. */
  const gaps = new Map();
  let scanned = 0;

  for (const info of packages.values()) {
    const imports = collectImports(info);

    for (const [specifier, files] of imports) {
      const name = toPackageName(specifier);
      if (name === null) continue; // відносний шлях або вбудований модуль
      scanned += 1;

      if (name === info.name) continue; // self-import через власне імʼя
      if (info.declared.has(name)) continue;

      const key = `${info.name}\u0000${name}`;
      const existing = gaps.get(key);
      if (existing) {
        for (const file of files) {
          if (!existing.files.includes(file)) existing.files.push(file);
        }
        continue;
      }

      const isSibling = packages.has(name);
      gaps.set(key, {
        pkg: info.name,
        dependency: name,
        field: isSibling
          ? 'dependencies'
          : classifyExternal(name, declaredPeers),
        version: isSibling
          ? 'workspace:*'
          : proposeRange(name, packages, rootVersions),
        files: [...files],
        packageJsonPath: info.packageJsonPath,
      });
    }
  }

  const missing = [...gaps.values()];
  for (const gap of missing) gap.files.sort();
  missing.sort(
    (a, b) =>
      a.pkg.localeCompare(b.pkg) || a.dependency.localeCompare(b.dependency),
  );

  return { scanned, packages: packages.size, missing };
}

/** Рядок звіту про один розрив. */
export function formatGap(gap) {
  const version = gap.version ?? '???(немає в кореневому package.json)';
  return `  ${gap.pkg} → ${gap.dependency} (${gap.field}: "${version}") — ${gap.files[0]}${
    gap.files.length > 1 ? ` (+${gap.files.length - 1})` : ''
  }`;
}

// ── CLI ──────────────────────────────────────────────────────────────────
const isMain =
  process.argv[1] && import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  const { scanned, packages, missing } = runAudit();

  console.log(
    `[audit-deps] Проскановано ${scanned} bare-імпорт(ів) у ${packages} пакетах (publish-roots: ${PUBLISH_ROOTS.map((r) => `${r}/`).join(', ')}).`,
  );

  if (missing.length === 0) {
    console.log('\n✅ 0 недекларованих залежностей.');
    process.exit(0);
  }

  console.log(`\n❌ ${missing.length} недекларованих залежностей:`);
  for (const gap of missing) console.log(formatGap(gap));
  process.exit(1);
}
