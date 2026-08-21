// Доставка агентних скілів у магазин: симлінки на теку `skills/` пакета
// `simplycms`. Окремий модуль, а не частина scaffold.mjs, — ліміт рядків.
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  symlinkSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

/** Теки магазину, звідки агенти читають скіли (Claude Code — друга). */

const SKILL_LINK_DIRS = ['.agents/skills', '.claude/skills'];

/** Тека скілів у встановленому ядрі. */
const packagedSkillsDir = (storeRoot) =>
  join(storeRoot, 'node_modules', 'simplycms', 'skills');

/**
 * Скіли, які везе пакет `simplycms`. Резерв рівно для одного випадку:
 * install пропущено, теки `node_modules` ще немає — лінки створюються
 * НАПЕРЕД (POSIX резолвить симлінк ліниво, тож після install вони оживають).
 * Реліз скаффолдера синхронний із ядром, а дрейф списку проти теки пакета
 * ловить `tests/create-store-template-parity.test.ts`.
 */
export const BUNDLED_SKILLS = ['redesign-from-reference'];

/** Імена скілів встановленого ядра; ядра ще немає → null (а не порожньо). */
export function listPackagedSkills(storeRoot) {
  const dir = packagedSkillsDir(storeRoot);
  if (!existsSync(dir)) return null;
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** Чи зайнято шлях (симлінк — теж зайнято, навіть якщо висить у порожнечу). */
function occupied(path) {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Симлінки на скіли пакета ядра — по одному в кожній теці SKILL_LINK_DIRS.
 *
 * 🔴 Саме лінки, а не копії: скіл оновлюється разом із ядром (`pnpm install`),
 * а копія в репозиторії магазину старіла б мовчки. Зайнятий шлях не чіпаємо —
 * власний скіл магазину з тим самим іменем сильніший за пакетний.
 *
 * @param {string} storeRoot Корінь магазину.
 * @param {string[]} [names] Скіли; за замовчуванням — з встановленого ядра.
 * @returns {string[]} Створені лінки (шляхи відносно кореня магазину).
 */
export function createSkillLinks(
  storeRoot,
  names = listPackagedSkills(storeRoot) ?? BUNDLED_SKILLS,
) {
  const created = [];
  for (const name of names) {
    for (const dir of SKILL_LINK_DIRS) {
      const linkPath = join(storeRoot, dir, name);
      if (occupied(linkPath)) continue;
      mkdirSync(join(storeRoot, dir), { recursive: true });
      // 🔴 Windows-junction вимагає АБСОЛЮТНОЇ цілі й реального каталогу;
      // POSIX-симлінк лишається відносним, щоб пережити перенос теки.
      const target =
        process.platform === 'win32'
          ? resolve(packagedSkillsDir(storeRoot), name)
          : `../../node_modules/simplycms/skills/${name}`;
      symlinkSync(
        target,
        linkPath,
        process.platform === 'win32' ? 'junction' : undefined,
      );
      created.push(`${dir}/${name}`);
    }
  }
  return created;
}

/**
 * Підключити скіли щойно розгорнутому магазину. Викликається ПІСЛЯ install:
 *
 * 🔴 На Windows лінк робиться junction-ом, а junction вимагає ІСНУЮЧОЇ цілі —
 * без `node_modules` він просто не створиться. Тому там при пропущеному
 * install лінків не робимо взагалі, а віддаємо `pending`: домалює їх
 * `simplycms update` після першого install. На POSIX симлінк резолвиться
 * ліниво, тож лінки створюються наперед і оживають самі.
 *
 * @param {string} storeRoot Корінь магазину.
 * @param {boolean} installed Чи відпрацював install залежностей.
 * @returns {{ created: string[]; pending: boolean }}
 */
export function linkSkills(storeRoot, installed) {
  if (!installed && process.platform === 'win32')
    return { created: [], pending: true };
  return { created: createSkillLinks(storeRoot), pending: false };
}
