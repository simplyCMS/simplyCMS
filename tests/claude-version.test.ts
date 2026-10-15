import { describe, expect, it } from 'vitest';
import {
  isOlderThanMinimum,
  parseClaudeVersion,
} from '../packages/cli/src/claude-version.mjs';

// Мінімум — 2.1.139 (поле `args` у хуках Claude Code); межі порівняння.
describe('claude-version', () => {
  it('parseClaudeVersion: версія з виводу `claude --version`; сміття → null', () => {
    expect(parseClaudeVersion('2.1.296 (Claude Code)\n')).toEqual([2, 1, 296]);
    expect(parseClaudeVersion('  10.0.1')).toEqual([10, 0, 1]);
    for (const junk of ['', 'не версія', 'v2.1.3', '2.1', 'Claude 2.1.3'])
      expect(parseClaudeVersion(junk)).toBeNull();
  });

  it('isOlderThanMinimum: межа 2.1.138/2.1.139 і старші/новіші мажор та мінор', () => {
    const older = (v: string) =>
      isOlderThanMinimum(parseClaudeVersion(v) as number[]);
    expect(older('2.1.138')).toBe(true);
    expect(older('2.1.139')).toBe(false);
    expect(older('2.1.140')).toBe(false);
    expect(older('2.2.0')).toBe(false);
    expect(older('3.0.0')).toBe(false);
    expect(older('1.99.999')).toBe(true);
    expect(older('2.0.999')).toBe(true);
  });
});
