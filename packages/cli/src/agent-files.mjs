// Файли агента в магазині: керований блок `AGENTS.md`, `CLAUDE.md` з імпортом
// `@AGENTS.md` і запис хука в `.claude/settings.json`. Одна реалізація для `update` (запис) і `doctor` №18
// (читання). Джерело вступу й дозволів — `simplycms/agent` ВСТАНОВЛЕНОГО ядра:
// блок має відповідати версії ядра магазину, а не версії CLI.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { HOOK_SCRIPT, ensureSessionStartHook } from './hook-entry.mjs';
import { applyManagedBlock, renderManagedBlock } from './managed-block.mjs';

const AGENTS_FILE = 'AGENTS.md';
const CLAUDE_FILE = 'CLAUDE.md';
const SETTINGS_FILE = '.claude/settings.json';
/** Claude Code сам `AGENTS.md` не читає: без цього рядка блок агенту невидимий. */
const AGENTS_IMPORT = '@AGENTS.md';

const coreAgentDir = (storeRoot) =>
  join(storeRoot, 'node_modules', 'simplycms', 'agent');

const readOrNull = (path) =>
  existsSync(path) ? readFileSync(path, 'utf8') : null;

/** Вступ ядра магазину (`simplycms/agent/intro.md`) або `null`, якщо ядро без `agent/`. */
export const readCoreIntro = (storeRoot) =>
  readOrNull(join(coreAgentDir(storeRoot), 'intro.md'));

/**
 * Стан файлів агента. `block: null` — ядро без `agent/` (не встановлене чи старе):
 * звіряти нема з чим. `claude`: `missing` — файлу немає (update створить з
 * `agent/claude-md.md`), `no-import` — файл власника без `@AGENTS.md` (не
 * переписується). `hook.status: 'invalid'` — `settings.json` не розібрати.
 * @param {string} storeRoot
 * @returns {{
 *   block: { status: 'ok' | 'drift' | 'missing' | 'damaged'; next?: string } | null;
 *   claude: { status: 'ok' | 'no-import' } | { status: 'missing'; next: string } | null;
 *   hook: { status: 'ok' | 'added' | 'updated'; next: string } | { status: 'invalid'; error: string };
 *   shimExists: boolean;
 * }}
 */
export function inspectAgentFiles(storeRoot) {
  const intro = readCoreIntro(storeRoot);
  const block =
    intro === null
      ? null
      : applyManagedBlock(
          readOrNull(join(storeRoot, AGENTS_FILE)),
          renderManagedBlock(intro),
        );
  const claudeSource = readOrNull(
    join(coreAgentDir(storeRoot), 'claude-md.md'),
  );
  const claudeText = readOrNull(join(storeRoot, CLAUDE_FILE));
  const claude =
    claudeSource === null
      ? null
      : claudeText === null
        ? { status: 'missing', next: claudeSource }
        : claudeText.split('\n').some((line) => line.trim() === AGENTS_IMPORT)
          ? { status: 'ok' }
          : { status: 'no-import' };
  let hook;
  try {
    // Файлу немає — те саме, що порожні налаштування: запис треба додати.
    hook = ensureSessionStartHook(
      readOrNull(join(storeRoot, SETTINGS_FILE)) ?? '{}',
    );
  } catch (error) {
    hook = { status: 'invalid', error: error.message };
  }
  return {
    block,
    claude,
    hook,
    shimExists: existsSync(join(storeRoot, HOOK_SCRIPT)),
  };
}

/** Запис хука треба додати чи оновити в `settings.json`. */
const needsHookWrite = ({ hook }) =>
  hook.status === 'added' || hook.status === 'updated';

/** Запис хука є, а шима немає: Claude Code на кожному старті сесії отримує помилку запуску. */
export const isShimMissing = ({ hook, shimExists }) =>
  !shimExists && (hook?.status === 'ok' || hook?.status === 'updated');

/**
 * Інваріант «запис хука ⇒ шим» (одне місце): запис пишеться, лише якщо шим уже є або
 * цей самий виклик його допише (`update --write` несе host-файли). Інакше — відкладено.
 * @param {ReturnType<typeof inspectAgentFiles>} state
 * @param {boolean} shimComing цей виклик допише шим
 */
export const isHookDeferred = (state, shimComing) =>
  needsHookWrite(state) && !state.shimExists && !shimComing;

/** Розбіжності файлів агента людською мовою (`--check`, doctor №18; частковий стан — теж). */
export function describeAgentDrift(state) {
  const { block, claude, hook } = state;
  const problems = [];
  if (block?.status === 'drift')
    problems.push('керований блок AGENTS.md розійшовся з версією ядра');
  if (block?.status === 'missing')
    problems.push('у AGENTS.md немає маркерів керованого блоку (або файлу)');
  if (block?.status === 'damaged')
    problems.push('маркери керованого блоку AGENTS.md пошкоджені');
  if (claude?.status === 'missing') problems.push('немає CLAUDE.md');
  if (claude?.status === 'no-import')
    problems.push(
      `CLAUDE.md не імпортує ${AGENTS_IMPORT} — Claude Code не бачить керованого блоку; ` +
        `додай рядок ${AGENTS_IMPORT} сам`,
    );
  if (hook?.status === 'added')
    problems.push('немає запису хука SessionStart у .claude/settings.json');
  if (hook?.status === 'updated')
    problems.push('запис хука SessionStart у .claude/settings.json застарів');
  if (isShimMissing(state))
    problems.push(`запис хука є, шиму ${HOOK_SCRIPT} немає`);
  return problems;
}

/**
 * Записати те, що `inspectAgentFiles` знайшов розбіжним. Блок `missing`/`damaged`,
 * `CLAUDE.md` без імпорту й невалідний JSON не пишуться — рішення за власником;
 * відсутній `CLAUDE.md` створюється (наявний не перезаписується ніколи). Запис хука
 * підпорядковується `isHookDeferred`.
 * @param {string} storeRoot
 * @param {ReturnType<typeof inspectAgentFiles>} state
 * @param {boolean} shimComing цей виклик допише шим
 * @returns {string[]} записані файли
 */
export function writeAgentFiles(storeRoot, state, shimComing) {
  const { block, claude, hook } = state;
  const written = [];
  if (claude?.status === 'missing') {
    writeFileSync(join(storeRoot, CLAUDE_FILE), claude.next);
    written.push(CLAUDE_FILE);
  }
  if (block?.status === 'drift') {
    writeFileSync(join(storeRoot, AGENTS_FILE), block.next);
    written.push(AGENTS_FILE);
  }
  if (needsHookWrite(state) && !isHookDeferred(state, shimComing)) {
    const path = join(storeRoot, SETTINGS_FILE);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, hook.next);
    written.push(SETTINGS_FILE);
  }
  return written;
}

/**
 * Рекомендовані дозволи Claude Code з ядра магазину рядками для звіту doctor №18;
 * ядро без них → [].
 * @param {string} storeRoot
 * @returns {string[]}
 */
export function describeRecommendedPermissions(storeRoot) {
  const text = readOrNull(join(coreAgentDir(storeRoot), 'permissions.json'));
  if (text === null) return [];
  const { allow, ask } = JSON.parse(text).permissions;
  return [
    'Рекомендовані дозволи Claude Code — читання вільно, зміни через підтвердження ' +
      '(update їх не зливає; перенеси в .claude/settings.json → permissions):',
    `allow: ${allow.join(', ')}`,
    `ask: ${ask.join(', ')}`,
  ];
}
