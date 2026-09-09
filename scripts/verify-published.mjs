#!/usr/bin/env node
/**
 * Післярелізна верифікація: чи всі пʼять публікованих пакетів (топологія К0)
 * доїхали в реєстр.
 *
 *   node verify-published.mjs 0.2.2
 *
 * Прогін публікації може впасти на середині, тож перевіряти вибірково —
 * недостатньо: потрібен явний перелік тих, хто НЕ на очікуваній версії.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const expected = process.argv[2];
if (!expected) {
  console.error('Вкажи очікувану версію: node verify-published.mjs 0.2.2');
  process.exit(1);
}

const names = readdirSync('packages')
  .map((dir) => join('packages', dir, 'package.json'))
  .filter((path) => existsSync(path))
  .map((path) => JSON.parse(readFileSync(path, 'utf8')))
  .filter((manifest) => manifest.private !== true)
  .map((manifest) => manifest.name)
  .sort();

console.log(`Очікуємо ${expected} у ${names.length} пакетах\n`);

const ok = [];
const bad = [];

for (const name of names) {
  let actual;
  try {
    actual = execFileSync('npm', ['view', `${name}@${expected}`, 'version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    actual = null; // 404 — цієї версії в реєстрі немає
  }
  const isOk = actual === expected;
  (isOk ? ok : bad).push(name);
  console.log(`${isOk ? '✓' : '✗'} ${name.padEnd(34)} ${actual ?? 'НЕМАЄ'}`);
}

console.log(`\nОпубліковано: ${ok.length}/${names.length}`);
if (bad.length) {
  console.log(`🔴 Не на ${expected}: ${bad.join(', ')}`);
  console.log(
    `Дія: НЕ бампати версію — workflow_dispatch на publish-packages;\n` +
      `isAlreadyPublished пропустить уже опубліковані й доллє решту.`,
  );
  process.exit(1);
}
console.log('✔ Усі пакети в реєстрі на очікуваній версії.');
