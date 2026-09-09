/**
 * Примус локальних tarball-ів у скретч-магазині.
 *
 * Парний модуль до `provenance.mjs`: цей ставить механізм, той доводить, що
 * механізм спрацював. Розділені навмисно — саме тому, що відмова тут мовчазна
 * і без окремої перевірки виглядає як успіх.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Дописати `overrides:` у `pnpm-workspace.yaml` скретча.
 *
 * 🔴 Чому overrides узагалі потрібні: пакетний менеджер НЕ резолвить
 * `file:`-транзитивність по імені. Якщо пакет A залежить від сиблінга B за
 * версією `0.2.1`, резолвер піде за ним у registry — і візьме там уже
 * ОПУБЛІКОВАНИЙ пакет замість того, що йде на публікацію. Тому в overrides
 * прописуються ВСІ пакети ядра: це єдиний спосіб примусити локальний tarball
 * на будь-якій глибині дерева. Перевірено прогоном на ланцюгу A→B→C.
 *
 * 🔴 Чому саме `pnpm-workspace.yaml`, а не manifest. З pnpm 11 це ЄДИНЕ місце,
 * звідки читаються налаштування: `pnpm.overrides` у package.json ігнорується з
 * попередженням, а npm-івський top-level `overrides` — МОВЧКИ, без жодного
 * сигналу. Мовчазна форма найнебезпечніша: install просто піде в registry, а
 * гейти A/C/D цього не побачать.
 *
 * 🔴 Чому мерджимо у файл із шаблону, а не приносимо оверлеєм: оверлей
 * копіюється ПОВЕРХ шаблону і затер би `allowBuilds`, без якого install
 * обривається `ERR_PNPM_IGNORED_BUILDS`.
 *
 * 🔴 Через overrides пілот НЕ перевіряє повноту `dependencies` у manifest-ах
 * пакетів (недекларована залежність усе одно встановиться). Статичну повноту
 * гарантує окремий гейт — `node scripts/audit-deps.mjs`.
 *
 * @param {string} storeDir тека скретч-магазину
 * @param {Map<string,string>} tarballs імʼя пакета → абсолютний шлях до `.tgz`
 */
export function writeOverrides(storeDir, tarballs) {
  const workspacePath = join(storeDir, 'pnpm-workspace.yaml');
  // Імена й шляхи — в одинарних лапках: `@` є YAML-індикатором, а `file:`
  // містить двокрапку. Мапа пласка, тож власного серіалізатора не треба.
  const lines = [...tarballs].map(
    ([name, tarball]) => `  '${name}': 'file:${tarball}'`,
  );

  const block = [
    '',
    '# ── Додано пілотом пакування (scripts/pilot-pack/overrides.mjs) ─────────',
    '# Примус локальних tarball-ів замість пакетів із реєстру. У магазині',
    '# кінцевого користувача цього блоку немає.',
    'overrides:',
    ...lines,
    '',
  ].join('\n');

  writeFileSync(
    workspacePath,
    readFileSync(workspacePath, 'utf8') + block,
    'utf8',
  );
}
