/**
 * Складання скретч-магазину: pack → scaffold → install → скіли →
 * довстановлення плагіна й тем → провенанс → vite build.
 *
 * Винесено з `run.mjs` (ліміт рядків): там лишається прогін гейтів, тут —
 * незмінна для всіх режимів підготовка магазину, який ці гейти читають.
 */

import { buildPackages, packAll } from './pack.mjs';
import { scaffoldStore } from './scaffold.mjs';
import { pnpmInstall, viteBuild } from './build.mjs';
import { installFaq } from './install-faq.mjs';
import { linkScratchSkills } from './link-skills.mjs';
import { installThemes } from './install-themes.mjs';
import { assertTarballProvenance } from './provenance.mjs';
import { step } from './report.mjs';

/**
 * @param {{ storeDir: string; tarballDir: string;
 *   env: Record<string,string>; skipBuild: boolean }} opts
 */
export async function prepareStore({ storeDir, tarballDir, env, skipBuild }) {
  if (!skipBuild) {
    step('Збірка пакетів ядра');
    buildPackages();
  }

  step('pnpm pack — tarball-и');
  const tarballs = packAll(tarballDir);
  console.log(`  спаковано ${tarballs.size} пакетів → ${tarballDir}`);

  step(`Розгортання скретч-магазину → ${storeDir}`);
  scaffoldStore({ storeDir, tarballs, env });

  step('pnpm install із tarball-ів');
  pnpmInstall(storeDir);

  // Ті самі симлінки, що ставить скаффолдер після install; чому крок окремий і
  // що саме він доводить — link-skills.mjs.
  step('Скіли: симлінки на node_modules/simplycms/skills');
  linkScratchSkills(storeDir);

  // FAQ-контур (ПК7): з шаблону плагін знято, а монорепо його монтує — без
  // довстановлення Gate A побачив би різні множини route-id. Чому окремим
  // кроком, а не оверлеєм — install-faq.mjs.
  step('FAQ-контур: simplycms add @simplycms/plugin-faq --plugin + монтування');
  installFaq(storeDir);

  // Обидві гілки §17.4 — тут і ніде інде; чому саме тут — install-themes.mjs.
  step('Теми: simplycms add --theme --copy і simplycms add --theme');
  installThemes(storeDir);

  // 🔴 Не гейт, а ПЕРЕДУМОВА: якщо ядро приїхало з реєстру замість tarball-ів,
  // усе далі втрачає сенс — гейти перевірятимуть уже опубліковані пакети
  // замість тих, що йдуть на публікацію. Відмова механізму overrides під pnpm
  // мовчазна, тому вона мусить мати власний голос саме тут.
  step('Провенанс — ядро з локальних tarball-ів');
  const provenance = assertTarballProvenance(storeDir, [...tarballs.keys()]);
  for (const line of provenance.details) console.log(`  ${line}`);
  if (!provenance.ok) {
    throw new Error(
      'Провенанс не підтверджено: пакети ядра приїхали не з tarball-ів. ' +
        'Перевір блок `overrides:` у pnpm-workspace.yaml скретча.',
    );
  }

  step('vite build');
  viteBuild(storeDir);
}
