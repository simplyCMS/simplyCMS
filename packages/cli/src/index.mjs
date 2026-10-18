#!/usr/bin/env node
// Вхід CLI `simplycms` — диспетчер команд обслуговування магазину SimplyCMS.
// Команди вантажаться динамічно: виклик doctor не тягне модулі add/update.
import { log } from '@clack/prompts';
import { COMMANDS } from './commands.mjs';
import { readCliVersion } from './context.mjs';

const HELP = `simplycms — CLI обслуговування магазину SimplyCMS

Використання:
  simplycms <команда> [опції]

Команди:
  doctor    Read-only діагностика магазину; --strict — попередження теж валять,
            --online — ще й стан БД (журнал міграцій, власник, профіль, листи; з DATABASE_URL),
            --production — перевіряти як прод (log-драйвер пошти — error, не warn)
  status    Етап магазину (не створено / не налаштовано / локально / розгорнуто), стан перевірок і наступний скіл:
              status [--json | --hook] [--production]
              (код 0 — гаразд, 3 — є що робити, інше — стан невідомий;
              --hook — вступ для агента + стан ≤25 рядків, без --production;
              онлайн-частина: БД, власник, профіль, листи; у етапі deployed ще й домен)
  smoke     Живий смоук розгорнутого магазину: smoke <url>
            (/api/health, сторінки, редирект /admin, robots, br, 413 на 3 МБ; код 1, якщо є ✗)
  deploy:record
            Запис розгортання .simplycms/deploy.json (без секретів) для скриптів скіла деплою:
              deploy:record get   (друкує валідований JSON; код 3 — запису немає, 1 — невалідний)
              deploy:record set   (JSON зі stdin; невалідне на диск не потрапляє)
  add       Встановити плагін або тему:
              add <pkg> (--plugin | --theme) [--name <key>] [--no-install] [--dry-run]
              --copy (лише з --theme) — copy-in: сирці теми в themes/<key>, пакет знімається
  create    Скаффолд плагіна або теми в самому магазині:
              create plugin <name> [--dry-run]
              create theme <name> [--dry-run]
  update    Оновити ядро, host-файли й файли агента (AGENTS.md, CLAUDE.md, хук):
              update [--check | --write] [--to <version>] [--no-install]
              --check: перевірка без мережі й install, нічого не пише
                       (код 0 — збігається, 3 — розбіжність, 1 — помилка)
  db:diff   Порівняти міграції магазину з канонами (ядро + плагіни): db:diff [--write]
  db:apply  Накатити db/migrations на БД (MIGRATION_DATABASE_URL — суперкористувач):
              db:apply [--dry-run | --check]   (--check: код 3, якщо є ненакочені)
  theme:conformance
            Conformance-гейт контракту тем v3: theme:conformance <name>
            (<name> — ключ теми в simplycms.config.ts; потребує jsdom)

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
  const code = await module.run(rest);
  // Команди з контрактом кодів виходу (db:apply) повертають число; решта
  // виставляє process.exitCode самі й повертають undefined.
  if (typeof code === 'number' && code !== 0) process.exitCode = code;
}

main().catch((error) => {
  log.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
