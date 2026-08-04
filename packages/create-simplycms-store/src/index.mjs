#!/usr/bin/env node
// Вхід CLI: `pnpm create simplycms-store my-shop`.
// Розгортає тонку збірку магазину зі шаблону пакета й підключає Supabase.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { intro, log, outro } from '@clack/prompts';
import { resolveOptions } from './args.mjs';
import { scaffold } from './scaffold.mjs';
import {
  initGit,
  installDeps,
  printNextSteps,
  promptMissing,
} from './steps.mjs';

// fileURLToPath, а не URL.pathname: на Windows pathname дає «/C:/…».
const TEMPLATE_DIR = fileURLToPath(new URL('../template', import.meta.url));
const PACKAGE_JSON = fileURLToPath(new URL('../package.json', import.meta.url));

/** Версія пакетів `@simplycms/*` = версія самого скаффолдера (реліз синхронний). */
function readVersion() {
  return JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')).version;
}

/** Імʼя npm-пакета магазину — basename теки призначення, а не сам шлях. */
function toStoreName(targetDir) {
  const name = basename(resolve(targetDir));
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(name)) {
    throw new Error(
      `Некоректне npm-імʼя магазину: «${name}». Дозволені малі літери, ` +
        'цифри, «.», «_», «-»; перший символ — літера або цифра.',
    );
  }
  return name;
}

/** Порожня тека — ок, теку з файлами не чіпаємо. */
function assertEmptyTarget(targetDir) {
  if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
    throw new Error(`Тека не порожня: ${resolve(targetDir)}`);
  }
}

async function main() {
  const parsed = resolveOptions(process.argv.slice(2));
  intro('create-simplycms-store');
  const options = parsed.yes ? parsed : await promptMissing(parsed);
  if (!options.storeName) {
    throw new Error(
      'Не задано теку магазину: `create-simplycms-store <тека>` ' +
        'або запуск у інтерактивному терміналі.',
    );
  }

  const targetDir = resolve(options.storeName);
  const storeName = toStoreName(targetDir);
  assertEmptyTarget(targetDir);

  await scaffold({
    templateDir: TEMPLATE_DIR,
    targetDir,
    storeName,
    version: readVersion(),
    supabaseUrl: options.supabaseUrl,
    supabaseKey: options.supabaseKey,
  });
  log.success(`Магазин «${storeName}» розгорнуто: ${targetDir}`);

  const installed = options.install ? installDeps(targetDir) : false;
  if (options.git) initGit(targetDir);

  printNextSteps({
    dirLabel: options.storeName,
    installed,
    hasEnv: Boolean(options.supabaseUrl && options.supabaseKey),
  });
  outro('Готово.');
}

main().catch((error) => {
  log.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
