// Розгортання шаблону: копія, перейменування службових імен, підстановки.
import {
  cpSync,
  existsSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

/**
 * Службові імена шаблону: `.gitignore` npm при паці обробляє спеціально,
 * решта — страховка від розбіжних політик менеджерів. Вміст tarball-а
 * стереже create-pkg-smoke (пілот).
 */
const RENAMES = {
  'package.json.tpl': 'package.json',
  gitignore: '.gitignore',
  'env.example': '.env.example',
};

/**
 * @param {string} tpl
 * @param {{ storeName: string; version: string }} vars
 * @returns {string}
 */
export function renderManifest(tpl, { storeName, version }) {
  return tpl
    .replaceAll('__STORE_NAME__', storeName)
    .replaceAll('__SIMPLYCMS_VERSION__', version);
}

/**
 * @typedef {object} ScaffoldInput
 * @property {string} templateDir
 * @property {string} targetDir
 * @property {string} storeName Імʼя npm-пакета магазину.
 * @property {string} version Версія пакетів `@simplycms/*`.
 * @property {string} [supabaseUrl]
 * @property {string} [supabaseKey]
 */

/** @param {ScaffoldInput} input */
export async function scaffold(input) {
  const { templateDir, targetDir, storeName, version } = input;
  cpSync(templateDir, targetDir, { recursive: true });
  // Перейменовуємо лише наявні: шаблон еволюціонує, відсутність службового
  // файлу не має валити скаффолд винятком із renameSync.
  for (const [from, to] of Object.entries(RENAMES)) {
    if (existsSync(join(targetDir, from))) {
      renameSync(join(targetDir, from), join(targetDir, to));
    }
  }
  const manifestPath = join(targetDir, 'package.json');
  writeFileSync(
    manifestPath,
    renderManifest(readFileSync(manifestPath, 'utf8'), { storeName, version }),
  );
  // .env.local пишемо тільки коли задані обидва значення: половинчастий файл
  // маскує «не налаштовано» під «налаштовано». service_role-ключа тут немає
  // за визначенням — він живе лише у змінній середовища на час owner:invite.
  if (input.supabaseUrl && input.supabaseKey) {
    writeFileSync(
      join(targetDir, '.env.local'),
      [
        `VITE_SUPABASE_URL=${input.supabaseUrl}`,
        `VITE_SUPABASE_PUBLISHABLE_KEY=${input.supabaseKey}`,
        'VITE_SITE_URL=http://localhost:3000',
        '',
      ].join('\n'),
    );
  }
}
