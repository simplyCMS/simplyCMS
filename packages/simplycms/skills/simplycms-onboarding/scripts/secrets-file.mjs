#!/usr/bin/env node
/**
 * Файл секретів магазину, значення якого не потрапляють у розмову агента.
 *
 *   secrets-file.mjs init <шлях>            # файл 0600 з порожніми ключами, шлях у .gitignore
 *   secrets-file.mjs gen <шлях> KEY         # випадкове значення (hex) у порожній ключ
 *   secrets-file.mjs pipe <шлях> KEY | dokploy-env.mjs set KEY --confirm
 *
 * Значення друкує лише `pipe` — у stdout конвеєра, не в термінал агента. Решта
 * команд виводить імена ключів і шлях.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  ensureGitignored,
  readSecret,
  SECRET_KEYS,
  setSecret,
} from './secrets-store.mjs';

const [command, rawPath, key] = process.argv.slice(2);
const usage = () => {
  console.error(
    'Використання: secrets-file init <шлях> | gen <шлях> KEY | pipe <шлях> KEY',
  );
  process.exit(2);
};
if (!rawPath || (command !== 'init' && !key)) usage();
const path = resolve(rawPath);

if (command === 'init') {
  const existed = existsSync(path);
  // Існуючий файл не перезаписуємо: у ньому можуть бути вже внесені секрети.
  if (!existed) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${SECRET_KEYS.map((k) => `${k}=`).join('\n')}\n`, {
      mode: 0o600,
    });
  }
  const ignored = ensureGitignored(path);
  console.log(`${existed ? 'Файл уже існує' : 'Створено'}: ${rawPath} (0600)`);
  if (ignored) console.log('Додано в .gitignore');
  console.log(`Ключі: ${SECRET_KEYS.join(', ')}`);
} else if (command === 'gen') {
  if (readSecret(path, key)) {
    console.error(`${key} уже заповнений — не перезаписую`);
    process.exit(1);
  }
  setSecret(path, key, randomBytes(32).toString('hex'));
  console.log(`Згенеровано: ${key}`);
} else if (command === 'pipe') {
  // Секрет не друкуємо в термінал (він потрапив би в розмову агента): лише в конвеєр.
  if (process.stdout.isTTY) {
    console.error('pipe віддає значення лише в конвеєр: | dokploy-env set KEY');
    process.exit(2);
  }
  const value = readSecret(path, key);
  if (!value) {
    console.error(`${key} порожній або відсутній у ${rawPath}`);
    process.exit(1);
  }
  process.stdout.write(value);
} else usage();
