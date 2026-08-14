#!/usr/bin/env node
// Вхід CLI `simplycms` — диспетчер команд обслуговування магазину SimplyCMS.
// Команди вантажаться динамічно: виклик doctor не тягне модулі add/update.
import { log } from '@clack/prompts';
import { readCliVersion } from './context.mjs';

/** Динамічні імпорти команд — модуль команди вантажиться лише за викликом. */
const COMMANDS = {
  doctor: () => import('./doctor.mjs'),
  add: () => import('./add.mjs'),
  update: () => import('./update.mjs'),
  'db:diff': () => import('./db-diff.mjs'),
};

const HELP = `simplycms — CLI обслуговування магазину SimplyCMS

Використання:
  simplycms <команда> [опції]

Команди:
  doctor    Read-only діагностика магазину; --strict — попередження теж валять
  add       Встановити плагін або тему:
              add <pkg> (--plugin | --theme) [--name <key>] [--no-install] [--dry-run]
  update    Оновити ядро і host-файли:
              update [--check | --write] [--to <version>] [--no-install]
  db:diff   Порівняти міграції магазину з міграціями ядра: db:diff [--write]

Опції:
  --help, -h       Ця довідка
  --version, -v    Версія CLI`;

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command === '--version' || command === '-v') {
    console.log(readCliVersion());
    return;
  }
  if (!command || command === '--help' || command === '-h') {
    console.log(HELP);
    // Запуск без команди — помилка використання; явний --help — ні.
    if (!command) process.exitCode = 1;
    return;
  }
  if (!Object.hasOwn(COMMANDS, command)) {
    console.error(`Невідома команда: ${command}\n`);
    console.log(HELP);
    process.exitCode = 1;
    return;
  }
  const module = await COMMANDS[command]();
  await module.run(rest);
}

main().catch((error) => {
  log.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
