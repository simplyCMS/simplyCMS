/**
 * Пошук незамінених плейсхолдерів шаблону в згенерованому магазині.
 *
 * Скаффолдер підставляє `__STORE_NAME__` / `__SIMPLYCMS_VERSION__` лише у
 * файлах зі свого списку. Забутий у списку файл доїжджає користувачу як є —
 * так `supabase/config.toml` віддавав `project_id = "__STORE_NAME__"`, а
 * Supabase CLI санітизував його в спільний для всіх магазинів `STORE_NAME__`
 * (спільні контейнери й мережа локального стеку). Тому гейт перевіряє ВЕСЬ
 * магазин, а не перелік файлів: наступний такий файл впаде тут, а не в проді.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Плейсхолдер шаблону: два підкреслення, ВЕЛИКІ літери, два підкреслення. */
const PLACEHOLDER = /__[A-Z][A-Z0-9_]*__/;

/**
 * Рекурсивний обхід файлів теки.
 * @param {string} dir
 * @returns {Generator<string>}
 */
function* walkFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkFiles(path);
    else if (entry.isFile()) yield path;
  }
}

/**
 * Файли магазину, у яких лишився плейсхолдер (шляхи — відносні до кореня).
 * @param {string} root
 * @returns {string[]}
 */
export function findPlaceholders(root) {
  const found = [];
  for (const path of walkFiles(root)) {
    if (PLACEHOLDER.test(readFileSync(path, 'utf8'))) {
      found.push(relative(root, path));
    }
  }
  return found;
}
