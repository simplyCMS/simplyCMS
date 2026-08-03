#!/usr/bin/env node
/**
 * Синхронний бамп версії всіх публікованих пакетів ядра.
 *
 * Модель версіонування (рішення власника): усі пакети `@simplycms/*` завжди
 * мають ОДНУ версію. Це найпростіше для споживача — версія ядра одна, і не
 * треба звіряти таблицю сумісності 21 пакета між собою.
 *
 * Використання:
 *   pnpm version:packages 0.2.0
 *
 * Далі — звичайний PR у `main`; публікацію робить workflow `publish-packages`
 * (пакети, чия версія вже в реєстрі, він пропускає сам).
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PACKAGES_DIR = 'packages/simplycms';
/** semver без пре-релізів: цього достатньо для синхронної моделі. */
const VERSION_RE = /^\d+\.\d+\.\d+$/;

const version = process.argv[2];

if (!version || !VERSION_RE.test(version)) {
  console.error(
    `Вкажи версію у форматі X.Y.Z, напр.: pnpm version:packages 0.2.0\n` +
      `Отримано: ${version ?? '(нічого)'}`,
  );
  process.exit(1);
}

const updated = [];
const skipped = [];

for (const dir of readdirSync(PACKAGES_DIR)) {
  const manifestPath = join(PACKAGES_DIR, dir, 'package.json');
  if (!existsSync(manifestPath)) continue;

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  // Приватні пакети не публікуються — версія їм не потрібна.
  if (manifest.private === true) {
    skipped.push(`${manifest.name} (private)`);
    continue;
  }

  if (manifest.version === version) {
    skipped.push(`${manifest.name} (вже ${version})`);
    continue;
  }

  manifest.version = version;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  updated.push(manifest.name);
}

console.log(`Версію ${version} проставлено пакетам: ${updated.length}`);
if (updated.length) console.log(`  ${updated.join('\n  ')}`);
if (skipped.length) console.log(`Пропущено: ${skipped.join(', ')}`);
console.log(
  `\nДалі: перевір діф, зроби PR у main — публікацію підхопить workflow.`,
);
