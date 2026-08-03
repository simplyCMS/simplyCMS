#!/usr/bin/env node
/**
 * Синхронний бамп версії всіх публікованих пакетів ядра — БЕЗ гейтів і коміту.
 *
 *   pnpm version:packages 0.2.0
 *
 * Це «сира» операція для нетипових випадків: вирівняти версії, що розійшлися,
 * або підготувати бамп руками. Звичайний шлях релізу — `pnpm release 0.2.0`
 * (гарди + гейти + коміт), див. `docs/architecture/release-process.md`.
 */
import { bumpTo, VERSION_RE } from './release/bump.mjs';

const version = process.argv[2];

if (!version || !VERSION_RE.test(version)) {
  console.error(
    `Вкажи версію у форматі X.Y.Z, напр.: pnpm version:packages 0.2.0\n` +
      `Отримано: ${version ?? '(нічого)'}`,
  );
  process.exit(1);
}

const { updated, skipped } = bumpTo(version);

console.log(`Версію ${version} проставлено пакетам: ${updated.length}`);
if (updated.length) console.log(`  ${updated.join('\n  ')}`);
if (skipped.length)
  console.log(`Пропущено (вже ${version}): ${skipped.length}`);
console.log(
  `\nГейти й коміт цей скрипт НЕ робить — для повного релізу: pnpm release ${version}`,
);
