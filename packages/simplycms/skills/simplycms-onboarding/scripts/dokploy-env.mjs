#!/usr/bin/env node
/**
 * Змінні оточення застосунку в Dokploy — без витоку секретів і без затирання.
 *
 *   dokploy-env.mjs keys                         # лише імена змінних
 *   dokploy-env.mjs set KEY --confirm < файл     # значення — ЛИШЕ зі stdin
 *   secrets-file.mjs pipe <файл> KEY | dokploy-env.mjs set KEY --confirm
 *   dokploy-env.mjs unset KEY --confirm
 *   --app <applicationId>  --secrets <файл>      # за замовчуванням — з deploy.json
 *
 * Значення не приймається аргументом (осіло б в історії shell і сесії агента) і не
 * друкується. Зміна: прочитати весь блок → змінити один ключ → записати; решта блоку
 * лишається байт-у-байт. `createEnvFile:false` завжди: інакше секрети потраплять в образ.
 * Без `--confirm` — прев'ю з іменем ключа і код 3.
 */
import { readFileSync } from 'node:fs';

import {
  credentials,
  dokploy,
  requireConfirm,
  resolveAppId,
  takeFlag,
} from './dokploy-client.mjs';
import { parseEnv, serializeEnv } from './secrets-store.mjs';

const args = process.argv.slice(2);
const confirm = takeFlag(args, '--confirm', false);
const appFlag = takeFlag(args, '--app');
const secrets = takeFlag(args, '--secrets');
const [command, key] = args;
const fail = (message, code) => {
  console.error(`dokploy-env: ${message}`);
  process.exit(code);
};
const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
if (
  !['keys', 'set', 'unset'].includes(command) ||
  (command !== 'keys' && !KEY_RE.test(key ?? ''))
)
  fail(
    'використання: keys | set KEY (значення зі stdin) | unset KEY [--confirm --app ID --secrets ФАЙЛ]',
    2,
  );

let value;
if (command === 'set') {
  if (process.stdin.isTTY)
    fail(
      'значення подається через stdin (pipe або < файл), не з клавіатури й не аргументом',
      2,
    );
  value = readFileSync(0, 'utf8').replace(/\r?\n$/, '');
  if (!value) fail('порожнє значення в stdin', 2);
  if (value.includes('\n')) fail('значення не може містити переносів рядка', 2);
}
if (command !== 'keys')
  requireConfirm(confirm, [
    `${command === 'set' ? 'set' : 'unset'} ${key} (значення не показується)`,
  ]);

try {
  const creds = credentials(secrets);
  const applicationId = resolveAppId(appFlag);
  const app = await dokploy(creds, 'application.one', {
    query: { applicationId },
  });
  const lines = parseEnv(app.env);
  const save = (next) =>
    dokploy(creds, 'application.saveEnvironment', {
      method: 'POST',
      body: {
        applicationId,
        env: serializeEnv(next),
        buildArgs: null,
        buildSecrets: null,
        createEnvFile: false,
      },
    });
  if (command === 'keys') {
    for (const l of lines) if (l.key) console.log(l.key);
  } else if (command === 'set') {
    const existing = lines.find((l) => l.key === key);
    if (existing) existing.value = value;
    else lines.push({ key, value });
    await save(lines);
    console.log(
      `${existing ? 'Оновлено' : 'Додано'}: ${key} (застосується з наступним деплоєм)`,
    );
  } else {
    const next = lines.filter((l) => l.key !== key);
    if (next.length === lines.length) console.log(`${key} і так немає`);
    else {
      await save(next);
      console.log(`Видалено: ${key} (застосується з наступним деплоєм)`);
    }
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error), 1);
}
