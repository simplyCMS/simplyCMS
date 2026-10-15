#!/usr/bin/env node

/**
 * Синхронізація генерованої частини шаблону `create-simplycms-store`
 * і канонічних артефактів ядра для `@simplycms/cli` (спека CLI v1, §5).
 *
 * Шаблон магазину — джерело правди скаффолдера, але частина його файлів
 * буквально дублює монорепо (host-каркас, міграції, дефолтна тема,
 * референс-плагін). Тримати їх форком — гарантований дрейф після першої ж
 * правки, тож вони СИНКУЮТЬСЯ звідси, а `tests/create-store-template-parity.test.ts`
 * червоніє, щойно копія розійдеться з джерелом (парність копії з джерелом).
 *
 * Додаткова ціль того самого механізму: `SYNCED_FILES` → `packages/cli/host/`
 * (канон для `simplycms update`, зі збереженням відносних шляхів).
 *
 * 🔴 Міграції течуть у ЗВОРОТНОМУ напрямку від того, що було до B13. Раніше
 * джерелом були кореневі міграції магазину, а `packages/simplycms/migrations/`
 * — їхнім дзеркалом. Тепер канон САМ по собі джерело правди (baseline + сід,
 * пишеться руками й `pnpm db:diff`), а копія в шаблоні — похідна від нього.
 * Кореневої теки міграцій більше не існує.
 *
 * Файли агента (Е8-Р5): керований блок шаблонного `AGENTS.md` рендериться з
 * вступу ядра (`packages/simplycms/agent/intro.md`) ТІЄЮ САМОЮ функцією, що й у
 * `simplycms update`; текст поза маркерами — статичний, його джерело сам шаблон.
 * `CLAUDE.md` — байт-копія `packages/simplycms/agent/claude-md.md`.
 *
 * Статичні файли шаблону (`package.json.tpl`, `vite.config.ts`, `routes.ts`,
 * `README.md` тощо) скрипт НЕ чіпає — їхнє джерело
 * правди сам шаблон.
 *
 * Використання: node scripts/sync-create-store-template.mjs
 */

import {
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import {
  applyManagedBlock,
  renderManagedBlock,
} from '../packages/cli/src/managed-block.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '..');

export const TEMPLATE_DIR = 'packages/create-simplycms-store/template';

/** Канон host-файлів пакета CLI — тека сама собі маніфест для `simplycms update`. */
export const CLI_HOST_DIR = 'packages/cli/host';

/** Канон міграцій ядра в tarball `simplycms` — джерело `simplycms db:diff`. */
export const SCHEMA_MIGRATIONS_DIR = 'packages/simplycms/migrations';

/** Джерело вступу й специфіки Claude Code для файлів агента магазину. */
export const AGENT_SOURCE_DIR = 'packages/simplycms/agent';

/** Host-файли: байт-ідентичні кореню монорепо (та сама 10-ка, що в пілоті). */
export const SYNCED_FILES = [
  'server.mjs',
  'server-runtime.mjs',
  'server-origin.mjs',
  'server-body-limit.mjs',
  'server-headers.mjs',
  'src/styles/globals.css',
  'src/routes/__root.tsx',
  'src/start.ts',
  'src/client.tsx',
  'src/router.tsx',
  'src/route-error.tsx',
  'src/server.ts',
  'src/engine-provider.tsx',
  // 🔴 Увійшов у канон 0.4.1. Доти файл був поза синком «бо template-варіант
  // навмисно відрізняється» — після знесення шару репозиторіїв копії стали
  // байт-ідентичними, і єдине, що тримало їх такими, — ручна правка обох при
  // кожній зміні. Рев'ю спіймало це як клас помилок: розсинхрон не побачив би
  // жоден гейт.
  'src/engine.shared.ts',
  'src/theme-registry.ts',
];

/**
 * Host-файли, чиє джерело — САМ шаблон (у корені монорепо їх немає): шими хука старту
 * сесії, прод-старту й запрошення власника (логіка двох останніх — у ядрі,
 * `simplycms/prod-start` і `simplycms/auth/owner-invite-cli`, F5 рев'ю Е8). У
 * `packages/cli/host/` їде копія, тож `update` оновлює шим у наявних магазинах, а
 * doctor №6 бачить його дрейф.
 */
export const TEMPLATE_HOST_FILES = [
  '.claude/hooks/session-start.mjs',
  'scripts/start.mjs',
  'scripts/owner-invite.mjs',
];

/** Теки: байт-ідентичні монорепо (snapshot на момент релізу). */
export const SYNCED_DIRS = [
  // Канон ядра → тека міграцій магазину (`db/migrations`: зміст — чистий
  // Postgres, назва без згадки постачальника).
  // 🔴 `removed.json` (маніфест видалених файлів канону) у магазин НЕ їде: його
  // читає CLI з установленого ядра (`node_modules/simplycms/migrations`), а
  // свіжий магазин видалених файлів не має — у `db/migrations` це був би
  // чужорідний файл поруч із міграціями.
  {
    from: SCHEMA_MIGRATIONS_DIR,
    to: 'db/migrations',
    exclude: ['removed.json'],
  },
  { from: 'themes/default', to: 'themes/default' },
  { from: 'plugins/hello-world', to: 'plugins/hello-world' },
  // 🔴 Скілів тут НЕМАЄ (трек К0): вони їдуть у магазин текою `skills/`
  // пакета `simplycms`, а `.agents/skills/` і `.claude/skills/` магазину —
  // симлінки на неї (створює скаффолдер, лагодить `simplycms update`).
  // Копія в шаблоні була б форком, що старіє мовчки при оновленні ядра.
];

/**
 * Перезаписати синковану частину шаблону вмістом монорепо.
 *
 * @param {string} root Корінь репозиторію (за замовчуванням — цей репозиторій).
 */
export function syncTemplate(root = REPO_ROOT) {
  for (const file of SYNCED_FILES) {
    const target = join(root, TEMPLATE_DIR, file);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(root, file), target);
  }
  for (const { from, to, exclude = [] } of SYNCED_DIRS) {
    const target = join(root, TEMPLATE_DIR, to);
    rmSync(target, { recursive: true, force: true });
    const source = join(root, from);
    cpSync(source, target, {
      recursive: true,
      filter: (path) => !exclude.includes(relative(source, path)),
    });
  }
  syncAgentFiles(root);
  // Канон host/ пакета CLI: та сама множина SYNCED_FILES зі збереженням
  // відносних шляхів. Теку пересоздаємо цілком — застарілий чи зайвий файл
  // (включно з .gitkeep) не переживає синк.
  const hostRoot = join(root, CLI_HOST_DIR);
  rmSync(hostRoot, { recursive: true, force: true });
  for (const file of SYNCED_FILES) {
    const target = join(hostRoot, file);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(root, file), target);
  }
  for (const file of TEMPLATE_HOST_FILES) {
    const target = join(hostRoot, file);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(root, TEMPLATE_DIR, file), target);
  }
}

/** Керований блок шаблонного `AGENTS.md` і `CLAUDE.md` — з вступу ядра. */
function syncAgentFiles(root) {
  const agentsPath = join(root, TEMPLATE_DIR, 'AGENTS.md');
  const intro = readFileSync(join(root, AGENT_SOURCE_DIR, 'intro.md'), 'utf8');
  const { status, next } = applyManagedBlock(
    readFileSync(agentsPath, 'utf8'),
    renderManagedBlock(intro),
  );
  // Без пари маркерів синк не вгадує місце блоку — так само, як update у магазині.
  if (next === undefined)
    throw new Error(`${TEMPLATE_DIR}/AGENTS.md: керований блок ${status}`);
  writeFileSync(agentsPath, next);
  cpSync(
    join(root, AGENT_SOURCE_DIR, 'claude-md.md'),
    join(root, TEMPLATE_DIR, 'CLAUDE.md'),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  syncTemplate();
  console.log(
    '[template:sync] шаблон і канон host/ CLI синхронізовано з монорепо.',
  );
}
