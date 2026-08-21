/**
 * Крок пілота: симлінки скілів у скретч-магазині + доказ, що вони РЕЗОЛВЛЯТЬСЯ.
 *
 * 🔴 Навіщо окремий крок. `scaffoldStore` копіює теку шаблону напряму, а не
 * запускає bin скаффолдера, тож `linkSkills` (він викликається з `index.mjs`
 * ПІСЛЯ install) у скретчі не відпрацьовує. Без цього кроку скретч не був би
 * еквівалентом магазину, розгорнутого справжнім `pnpm create` — а саме таку
 * еквівалентність scaffold.mjs і обіцяє.
 *
 * 🔴 Що доводить саме тут і ніде інде: що ціль лінка ІСНУЄ в pnpm-ізольованому
 * дереві. У Gate CLI лінк створюється на голому скаффолді (`--no-install`), тож
 * там він висить у порожнечу за побудовою; юніти CLI ходять по стабах. Отже
 * ланцюг «`../../node_modules/simplycms` → симлінк pnpm на `.pnpm/…` → тека
 * `skills/` із tarball-а» цілком складається лише у встановленому магазині.
 *
 * Функція створення лінків береться ЗІ СКАФФОЛДЕРА, а не пишеться заново:
 * пілот мусить прожити той самий код, що й користувач.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createSkillLinks } from '../../packages/create-simplycms-store/src/skill-links.mjs';

/** Файл-маніфест скіла: його наявність і робить теку скілом. */
const SKILL_ENTRY = 'SKILL.md';

/**
 * Створити лінки скілів у скретчі й довести, що кожен читається наскрізь.
 *
 * @param {string} storeDir тека скретч-магазину
 * @returns {string[]} створені лінки (шляхи відносно кореня магазину)
 */
export function linkScratchSkills(storeDir) {
  const created = createSkillLinks(storeDir);
  if (created.length === 0) {
    throw new Error(
      'Скіли: скаффолдер не створив жодного лінка — у node_modules/simplycms ' +
        'немає теки skills/ (звузився `files` пакета?).',
    );
  }

  for (const link of created) {
    const entry = join(storeDir, link, SKILL_ENTRY);
    // readFileSync, а не existsSync: висячий лінк existsSync теж дає false,
    // а тут потрібне саме читання наскрізь — інакше «доказ» був би про шлях,
    // а не про вміст, який побачить агент у магазині.
    const head = readFileSync(entry, 'utf8').slice(0, 200);
    if (!head.includes('name:')) {
      throw new Error(
        `Скіли: ${link}/${SKILL_ENTRY} без фронтматера — битий лінк?`,
      );
    }
    const files = readdirSync(join(storeDir, link), { recursive: true }).length;
    console.log(`  ${link} → читається наскрізь, елементів у скілі: ${files}`);
  }
  return created;
}
