/**
 * Твердження Gate CLI про артефакт СКАФФОЛДЕРА: структура згенерованого
 * магазину плюс інваріанти топології 5 і доставки скілів (трек К0).
 *
 * Винесено з `create-pkg-smoke.mjs` (ліміт рядків): там лишається сценарій
 * «спакувати → розпакувати → скаффолдити», тут — самі твердження.
 *
 * 🔴 Перевірки навмисно дивляться на TARBALL і на його скаффолд, а не на теку
 * репо: `files` у манифесті легко звузити або розширити випадково, і саме ця
 * різниця доїжджає до користувача. Парність скілів у tarball ЯДРА — сусідній
 * модуль `core-skills-parity.mjs`.
 */

import { existsSync, readFileSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';
import { findPlaceholders } from './placeholder-scan.mjs';

/** Теки, які скаффолдер лінкує; ті самі, що в `src/skill-links.mjs`. */
const SKILL_LINK_DIRS = ['.agents/skills', '.claude/skills'];

/** Ціль POSIX-симлінка — відносна, щоб пережити перенос теки магазину. */
const linkTarget = (name) => `../../node_modules/simplycms/skills/${name}`;

/** Файли, без яких згенерований магазин не є магазином. */
const EXPECTED_FILES = [
  'package.json',
  '.gitignore',
  '.env.example',
  'routes.ts',
  'vite.config.ts',
  'simplycms.config.ts',
  'src/routes/__root.tsx',
  'themes/default/index.ts',
  'supabase/config.toml',
  'supabase/templates/invite.html',
  'scripts/owner-invite.mjs',
  // 🔴 Без нього pnpm 11 обриває install (`ERR_PNPM_IGNORED_BUILDS`), а
  // `pnpm build` перезапускає install і теж падає — магазин не збереться.
  // Вміст стереже tests/create-store-cli.test.ts; тут — сам факт потрапляння
  // у tarball, бо `files` у манифесті легко звузити випадково.
  'pnpm-workspace.yaml',
  // 🔴 Скілів у шаблоні НЕМАЄ (трек К0): вони їдуть текою `skills/` пакета
  // `simplycms`, а магазин отримує симлінки від скаффолдера. Інваріанти
  // доставки скілів — окремим кроком гейта (Task 7 плану К0).
];
/**
 * Структура згенерованого магазину: усі очікувані файли на місці, службові
 * імена перейменовані, плейсхолдери шаблону підставлені.
 */
export function checkStoreStructure(storeDir) {
  const details = [];
  for (const file of EXPECTED_FILES) {
    if (!existsSync(join(storeDir, file)))
      return { ok: false, details: [...details, `✗ відсутній ${file}`] };
    details.push(`✓ ${file}`);
  }
  if (existsSync(join(storeDir, 'package.json.tpl')))
    return {
      ok: false,
      details: [...details, '✗ package.json.tpl не перейменовано'],
    };
  const leftovers = findPlaceholders(storeDir);
  if (leftovers.length > 0)
    return {
      ok: false,
      details: [...details, `✗ плейсхолдери не підставлено: ${leftovers}`],
    };
  details.push('✓ плейсхолдерів __NAME__ не лишилось');
  return { ok: true, details };
}

/**
 * (а) У tarball скаффолдера НЕМАЄ копії скілів.
 *
 * Копія в шаблоні означала б форк скіла в кожному магазині, який старіє
 * мовчки: `pnpm install` оновлює пакет, а закомічену копію — ніхто.
 */
export function checkNoSkillCopies(pkgDir) {
  const stray = ['template/.claude', 'template/.agents'].filter((dir) =>
    existsSync(join(pkgDir, dir)),
  );
  return stray.length === 0
    ? { ok: true, details: ['✓ tarball скаффолдера без копії скілів'] }
    : { ok: false, details: [`✗ у tarball доїхали копії скілів: ${stray}`] };
}

/**
 * (б) `package.json.tpl`: рівно один пакет ядра — unscoped `simplycms`; FAQ
 * у стартовому магазині немає (ПК7), CLI лишається scoped у devDeps.
 */
export function checkTemplateDeps(pkgDir) {
  const tpl = JSON.parse(
    readFileSync(join(pkgDir, 'template/package.json.tpl'), 'utf8'),
  );
  const scoped = Object.keys(tpl.dependencies ?? {}).filter((name) =>
    name.startsWith('@simplycms/'),
  );
  if (!tpl.dependencies?.simplycms || scoped.length > 0) {
    return {
      ok: false,
      details: [
        `✗ deps шаблону: simplycms=${tpl.dependencies?.simplycms ?? '—'}, ` +
          `scoped-пакети ядра: ${scoped.join(', ') || 'немає'}`,
      ],
    };
  }
  if (!tpl.devDependencies?.['@simplycms/cli']) {
    return { ok: false, details: ['✗ @simplycms/cli не в devDeps шаблону'] };
  }
  return {
    ok: true,
    details: ['✓ deps шаблону: рівно один simplycms, без FAQ'],
  };
}

/**
 * (в) Після скаффолду обидві теки несуть симлінк на скіл із очікуваною ціллю.
 *
 * 🔴 Перевіряється саме `readlinkSync`, а не `existsSync`: скаффолд іде без
 * install, тож ціль ще не існує — лінк ВИСИТЬ, і `existsSync` на ньому дає
 * false. Хибним «✗» це не є: POSIX резолвить симлінк ліниво, тож після
 * першого install лінк оживає сам.
 */
export function checkSkillLinks(storeDir, name = 'redesign-from-reference') {
  const details = [];
  for (const dir of SKILL_LINK_DIRS) {
    const path = join(storeDir, dir, name);
    let actual;
    try {
      actual = readlinkSync(path);
    } catch {
      return {
        ok: false,
        details: [...details, `✗ немає симлінка ${dir}/${name}`],
      };
    }
    if (actual !== linkTarget(name)) {
      return {
        ok: false,
        details: [...details, `✗ ${dir}/${name} → ${actual}`],
      };
    }
    details.push(`✓ ${dir}/${name} → ${actual}`);
  }
  return { ok: true, details };
}
