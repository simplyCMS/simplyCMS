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
 * Файли з плейсхолдерами — шляхи ПІСЛЯ перейменувань (RENAMES). Саме список,
 * а не хардкод одного `package.json`: наступний шаблонізований файл додається
 * сюди рядком і не губиться мовчки (так `supabase/config.toml` доїжджав до
 * користувача з `project_id = "__STORE_NAME__"`, а Supabase CLI санітизував
 * його в спільний для всіх магазинів `STORE_NAME__`).
 */
const TEMPLATED_FILES = ['package.json', 'supabase/config.toml'];

/**
 * Підстановка плейсхолдерів шаблону. Назва загальна замість `renderManifest`:
 * рендериться не лише manifest, а будь-який файл із TEMPLATED_FILES.
 * @param {string} tpl
 * @param {{ storeName: string; version: string }} vars
 * @returns {string}
 */
export function renderTemplate(tpl, { storeName, version }) {
  return tpl
    .replaceAll('__STORE_NAME__', storeName)
    .replaceAll('__SIMPLYCMS_VERSION__', version);
}

/**
 * @typedef {object} ScaffoldInput
 * @property {string} templateDir
 * @property {string} targetDir
 * @property {string} storeName Імʼя npm-пакета магазину.
 * @property {string} version Версія пакетів ядра (`simplycms`, `@simplycms/*`).
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
  // Відсутність шаблонізованого файлу — не «шаблон еволюціонував», а розсинхрон
  // списку з шаблоном: мовчазний skip повернув би рівно ту ваду, від якої список.
  for (const relative of TEMPLATED_FILES) {
    const path = join(targetDir, relative);
    if (!existsSync(path)) {
      throw new Error(`Шаблонізований файл відсутній у шаблоні: ${relative}`);
    }
    writeFileSync(
      path,
      renderTemplate(readFileSync(path, 'utf8'), { storeName, version }),
    );
  }
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
