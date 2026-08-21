// Лінки агентних скілів магазину на теку `skills/` пакета `simplycms`
// (трек К0): скіл живе в ядрі й оновлюється разом із ним, магазин тримає
// лише симлінки. Читання (doctor, перевірка №12) і лагодження (update)
// користуються однією реалізацією.
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { say } from './ui.mjs';

/** Теки магазину, звідки агенти читають скіли (Claude Code — друга). */
export const SKILL_LINK_DIRS = ['.agents/skills', '.claude/skills'];

/** Тека скілів у встановленому ядрі. */
export const packagedSkillsDir = (storeRoot) =>
  join(storeRoot, 'node_modules', 'simplycms', 'skills');

/** Маркер «лінк веде в пакет ядра» — за ним пізнаються осиротілі лінки. */
const PACKAGE_MARKER = join('node_modules', 'simplycms', 'skills');

/** Імена скілів встановленого ядра; ядра (чи його skills/) немає → null. */
export function listPackagedSkills(storeRoot) {
  const dir = packagedSkillsDir(storeRoot);
  if (!existsSync(dir)) return null;
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** lstat без винятку: відсутній шлях → null (симлінк-у-порожнечу → є). */
function lstatOrNull(path) {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
}

/** Чи веде цей лінк у теку скілів пакета ядра (а не кудись у магазин). */
function pointsIntoPackage(linkPath) {
  const stat = lstatOrNull(linkPath);
  if (!stat?.isSymbolicLink()) return false;
  return readlinkSync(linkPath).includes(PACKAGE_MARKER);
}

/**
 * Стан лінків: `missing` — скіл ядра без робочого лінка; `orphaned` — лінк у
 * теку скілів ядра, якому вже нічого не відповідає (скіл прибрали чи
 * перейменували). Власний файл/теку магазину з тим самим іменем не чіпаємо —
 * форк сильніший за пакетний скіл, це свідомий вибір автора магазину.
 * @param {string} storeRoot
 * @returns {{ skills: string[] | null; missing: string[]; orphaned: string[] }}
 */
export function inspectSkillLinks(storeRoot) {
  const skills = listPackagedSkills(storeRoot);
  if (skills === null) return { skills: null, missing: [], orphaned: [] };
  const missing = [];
  const orphaned = [];
  for (const dir of SKILL_LINK_DIRS) {
    for (const name of skills) {
      const path = join(storeRoot, dir, name);
      const stat = lstatOrNull(path);
      // Битий лінк у пакет — теж «відсутній»: його треба перестворити.
      if (stat === null || (pointsIntoPackage(path) && !existsSync(path)))
        missing.push(`${dir}/${name}`);
    }
    const linkDir = join(storeRoot, dir);
    if (!existsSync(linkDir)) continue;
    for (const entry of readdirSync(linkDir)) {
      if (skills.includes(entry)) continue;
      if (pointsIntoPackage(join(linkDir, entry)))
        orphaned.push(`${dir}/${entry}`);
    }
  }
  return { skills, missing: missing.sort(), orphaned: orphaned.sort() };
}

/**
 * Полагодити лінки: прибрати осиротілі, доробити відсутні.
 * @param {string} storeRoot
 * @returns {{ created: string[]; removed: string[] }}
 */
export function reconcileSkillLinks(storeRoot) {
  const { missing, orphaned } = inspectSkillLinks(storeRoot);
  for (const relative of orphaned)
    rmSync(join(storeRoot, relative), { force: true });
  for (const relative of missing) {
    const path = join(storeRoot, relative);
    rmSync(path, { force: true });
    mkdirSync(join(storeRoot, relative.split('/').slice(0, -1).join('/')), {
      recursive: true,
    });
    const name = relative.split('/').at(-1);
    // 🔴 Windows-junction вимагає АБСОЛЮТНОЇ цілі; POSIX-симлінк лишається
    // відносним, щоб пережити перенос теки магазину.
    const target =
      process.platform === 'win32'
        ? resolve(packagedSkillsDir(storeRoot), name)
        : `../../node_modules/simplycms/skills/${name}`;
    symlinkSync(
      target,
      path,
      process.platform === 'win32' ? 'junction' : undefined,
    );
  }
  return { created: missing, removed: orphaned };
}

/**
 * Полагодити лінки й доповісти про зроблене (крок `simplycms update`).
 * Мовчить, коли лагодити нічого — це нормальний стан магазину.
 * @param {string} storeRoot
 */
export function syncSkillLinks(storeRoot) {
  const { created, removed } = reconcileSkillLinks(storeRoot);
  if (removed.length > 0)
    say.success(`Прибрано осиротілі лінки скілів: ${removed.join(', ')}`);
  if (created.length > 0)
    say.success(`Підключено скіли: ${created.join(', ')}`);
  return { created, removed };
}
