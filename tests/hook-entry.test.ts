import { describe, expect, it } from 'vitest';
import { ensureSessionStartHook } from '../packages/cli/src/hook-entry.mjs';

// Запис хука старту сесії (Б §3.2): update доглядає лише свій запис у settings.json.
const SCRIPT = '${CLAUDE_PROJECT_DIR}/.claude/hooks/session-start.mjs';
// Старий відносний запис: залежав від поточної теки агента.
const LEGACY_COMMAND = 'node .claude/hooks/session-start.mjs';
const OURS = { type: 'command', command: 'node', args: [SCRIPT], timeout: 10 };
const parse = (text: string) => JSON.parse(text);

describe('ensureSessionStartHook', () => {
  it('порожній {} → added з канонічним записом', () => {
    const { status, next } = ensureSessionStartHook('{}');
    expect(status).toBe('added');
    expect(parse(next).hooks.SessionStart).toEqual([
      {
        matcher: 'startup|clear|compact',
        hooks: [OURS],
      },
    ]);
  });

  it('сторонні ключі й хуки (PreToolUse, чужий SessionStart) збережено', () => {
    const own = {
      permissions: { allow: ['Read'] },
      hooks: {
        PreToolUse: [
          {
            matcher: 'Bash',
            hooks: [{ type: 'command', command: 'echo pre' }],
          },
        ],
        SessionStart: [
          {
            matcher: 'startup',
            hooks: [{ type: 'command', command: 'echo hi' }],
          },
        ],
      },
    };
    const { status, next } = ensureSessionStartHook(JSON.stringify(own));
    expect(status).toBe('added');
    const result = parse(next);
    expect(result.permissions).toEqual(own.permissions);
    expect(result.hooks.PreToolUse).toEqual(own.hooks.PreToolUse);
    expect(result.hooks.SessionStart[0]).toEqual(own.hooks.SessionStart[0]);
    expect(result.hooks.SessionStart).toHaveLength(2);
  });

  it('повторно → ok, текст незмінний', () => {
    const first = ensureSessionStartHook('{"model":"x"}').next;
    expect(ensureSessionStartHook(first)).toEqual({
      status: 'ok',
      next: first,
    });
  });

  it('змінена команда чи таймаут → updated, наш запис один і канонічний', () => {
    const canon = ensureSessionStartHook('{}').next;
    const changed = canon
      .replace('"command": "node"', '"command": "node --old"')
      .replace('"timeout": 10', '"timeout": 99');
    const { status, next } = ensureSessionStartHook(changed);
    expect(status).toBe('updated');
    expect(next).toBe(canon);
  });

  it('чужий хук у нашій групі лишається, наш виноситься канонічною групою', () => {
    const mixed = {
      hooks: {
        SessionStart: [
          {
            matcher: 'startup',
            hooks: [
              { type: 'command', command: LEGACY_COMMAND },
              { type: 'command', command: 'echo theirs' },
            ],
          },
        ],
      },
    };
    const { status, next } = ensureSessionStartHook(JSON.stringify(mixed));
    expect(status).toBe('updated');
    const list = parse(next).hooks.SessionStart;
    expect(list[0]).toEqual({
      matcher: 'startup',
      hooks: [{ type: 'command', command: 'echo theirs' }],
    });
    expect(list[1].hooks[0]).toEqual(OURS);
    expect(ensureSessionStartHook(next).status).toBe('ok');
  });

  it('старий відносний запис (node .claude/hooks/…) → updated на exec-форму', () => {
    const legacy = {
      hooks: {
        SessionStart: [
          {
            matcher: 'startup|clear|compact',
            hooks: [{ type: 'command', command: LEGACY_COMMAND, timeout: 10 }],
          },
        ],
      },
    };
    const { status, next } = ensureSessionStartHook(JSON.stringify(legacy));
    expect(status).toBe('updated');
    expect(parse(next).hooks.SessionStart).toEqual([
      { matcher: 'startup|clear|compact', hooks: [OURS] },
    ]);
  });

  it('невалідний JSON чи не-обʼєкт → помилка', () => {
    expect(() => ensureSessionStartHook('{ зламано')).toThrow(/валідним JSON/);
    expect(() => ensureSessionStartHook('[]')).toThrow(/обʼєктом/);
    expect(() =>
      ensureSessionStartHook('{"hooks":{"SessionStart":{}}}'),
    ).toThrow(/масивом/);
  });
});
