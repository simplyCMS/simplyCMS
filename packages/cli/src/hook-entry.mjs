// Запис хука старту сесії в `.claude/settings.json` магазину (Б §3.2). `update`
// доглядає лише СВІЙ запис: решта ключів і чужі хуки — власника, дозволи не зливаються.
import { isDeepStrictEqual } from 'node:util';

/** Шлях шима — за ним упізнається наш запис, навіть якщо команду змінили. */
export const HOOK_SCRIPT = '.claude/hooks/session-start.mjs';

/**
 * Канонічний запис: та сама форма, що в шаблонному `settings.json`. Exec-форма
 * (`command` + `args`, без shell) із `${CLAUDE_PROJECT_DIR}`: відносний шлях
 * `node .claude/hooks/…` залежить від поточної теки процесу хука; плейсхолдер у
 * `args` не потребує лапок.
 */
const SESSION_START_ENTRY = {
  matcher: 'startup|clear|compact',
  hooks: [
    {
      type: 'command',
      command: 'node',
      args: [`\${CLAUDE_PROJECT_DIR}/${HOOK_SCRIPT}`],
      timeout: 10,
    },
  ],
};

// Упізнає і новий запис (шлях у `args`), і старий відносний (`node .claude/hooks/…` у `command`).
const isOurs = (hook) =>
  (typeof hook?.command === 'string' && hook.command.includes(HOOK_SCRIPT)) ||
  (Array.isArray(hook?.args) &&
    hook.args.some((a) => typeof a === 'string' && a.includes(HOOK_SCRIPT)));
const holdsOurs = (group) =>
  Array.isArray(group?.hooks) && group.hooks.some(isOurs);

/** Обʼєкт (не масив, не null) або гучна відмова: писати поверх незрозумілого не можна. */
function requireObject(value, what) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`.claude/settings.json: ${what} має бути обʼєктом`);
  return value;
}

/**
 * Привести запис `SessionStart` до канону. Наш запис шукається за шляхом шима в
 * `hooks.SessionStart[]`; чужі хуки з тієї ж групи лишаються в ній, наш виноситься
 * канонічною групою на її місце. Невалідний JSON → виняток, нічого не пишеться.
 * @param {string} settingsJsonText
 * @returns {{ status: 'ok' | 'added' | 'updated', next: string }}
 */
export function ensureSessionStartHook(settingsJsonText) {
  let parsed;
  try {
    parsed = JSON.parse(settingsJsonText);
  } catch (error) {
    throw new Error(
      `.claude/settings.json не є валідним JSON (${error.message}) — виправ файл вручну`,
    );
  }
  const settings = requireObject(parsed, 'корінь');
  const hooks = requireObject(settings.hooks ?? {}, 'hooks');
  const list = hooks.SessionStart ?? [];
  if (!Array.isArray(list))
    throw new Error(
      '.claude/settings.json: hooks.SessionStart має бути масивом',
    );
  const ours = list.filter(holdsOurs);
  if (ours.length === 1 && isDeepStrictEqual(ours[0], SESSION_START_ENTRY))
    return { status: 'ok', next: settingsJsonText };
  const at = list.findIndex(holdsOurs);
  const next = list.flatMap((group, index) => {
    if (!holdsOurs(group)) return [group];
    const residue = { ...group, hooks: group.hooks.filter((h) => !isOurs(h)) };
    const kept = residue.hooks.length > 0 ? [residue] : [];
    // Канонічна група стає на місце першої нашої — порядок хуків власника не зсувається.
    return index === at ? [...kept, SESSION_START_ENTRY] : kept;
  });
  if (at === -1) next.push(SESSION_START_ENTRY);
  const result = { ...settings, hooks: { ...hooks, SessionStart: next } };
  return {
    status: at === -1 ? 'added' : 'updated',
    next: `${JSON.stringify(result, null, 2)}\n`,
  };
}
