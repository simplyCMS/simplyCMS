#!/usr/bin/env node

/**
 * Consumed-subpath аудит exports (Task 1.2).
 *
 * У монорепо workspace-аліаси (`tsconfig.json` paths, `vite.config.ts`
 * `resolve.alias`) резолвлять БУДЬ-ЯКИЙ subpath пакета напряму на файл у
 * `src/`/`routes/` — навіть той, якого немає в `package.json#exports`. При
 * справжньому `pnpm install` (tarball, без аліасів) Node різко впаде на
 * `ERR_PACKAGE_PATH_NOT_EXPORTED` для такого subpath-у. Цей скрипт зводить
 * докупи (а) усі реально вжиті субшлях-специфікатори ядра
 * (`@simplycms/<pkg>/<subpath>` і `simplycms/<subpath>`) і
 * (б) ключі `exports`/`publishConfig.exports` у manifest-і кожного пакета —
 * і друкує розриви.
 *
 * Мапа "імʼя пакета → тека" будується з поля `name` у `package.json`, НЕ з
 * імені теки: `@simplycms/plugin-faq` живе в `simplycms-plugin-faq/`,
 * `@simplycms/theme-solarstore` — у `simplycms-theme-solarstore/`.
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
 *
 * Аргументи — лише для тестів (негативний контроль): за замовчуванням і
 * пакети, і специфікатори беруться з репо.
 *
 * @param {{ packages?: Map<string, unknown>; specifiers?: string[] }} [input]
 * @returns {{
 *   scanned: number;
 *   missing: { specifier: string; pkg: string; reason: string; packageJsonPath: string }[];
 *   stale: { specifier: string; pkg: string }[];
 * }}
 */
export function runAudit(input = {}) {
  const packages = input.packages ?? collectPackages();
  const specifiers = input.specifiers ?? collectSpecifiers();

  const missing = [];
  const stale = [];

  for (const specifier of specifiers) {
    // Дві гілки імені ядра: scoped-сателіт і unscoped-флагман (К0).
    const match = /^(@simplycms\/[a-zA-Z0-9_-]+|simplycms)\/(.+)$/.exec(
      specifier,
    );
    if (!match) continue;
    const [, pkgName, subpath] = match;
    const info = packages.get(pkgName);

    if (!info) {
      // 🔴 Імʼя в просторі ядра, якому не відповідає жоден workspace-пакет —
      // це РОЗРИВ, а не «поза скоупом». Після К0 живих імен рівно пʼять, тож
      // `@simplycms/<щось-інше>` означає одне з двох: специфікатор злитого
      // пакета (`@simplycms/runtime`, `@simplycms/objects`, …) або одрук.
      // До 2026-08-21 такі рядки мовчки лягали в інформаційний кошик, і
      // жоден тест його не асертив: файл із `@simplycms/runtime/defineRuntime`
      // тримав гейт зеленим. У монорепо це невидимо (tsconfig-аліасів для
      // мертвих імен уже немає, але теки поза root tsconfig — шаблон,
      // `packages/cli/host`, `.mjs`-скрипти — типізації не мають), а в
      // магазині дає `ERR_MODULE_NOT_FOUND` на неіснуючому пакеті.
      stale.push({ specifier, pkg: pkgName });
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

  return { scanned: specifiers.length, missing, stale };
}

// ── CLI ──────────────────────────────────────────────────────────────────
const isMain =
  process.argv[1] && import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  const { scanned, missing, stale } = runAudit();

  console.log(
    `[audit-exports] Проскановано ${scanned} унікальних субшлях-специфікаторів ядра.`,
  );

  if (stale.length > 0) {
    console.log(
      `\n❌ ${stale.length} специфікатор(ів) неіснуючого пакета ядра (злите імʼя або одрук):`,
    );
    for (const item of stale) {
      console.log(
        `  ${item.specifier} — пакета «${item.pkg}» немає в packages/`,
      );
    }
  }

  if (missing.length > 0) {
    console.log(`\n❌ ${missing.length} відсутніх exports:`);
    for (const m of missing) {
      console.log(
        `  ${m.specifier} — немає ключа в ${m.reason} (${m.packageJsonPath})`,
      );
    }
  }

  if (missing.length === 0 && stale.length === 0) {
    console.log('\n✅ 0 відсутніх exports.');
    process.exit(0);
  }
  process.exit(1);
}
