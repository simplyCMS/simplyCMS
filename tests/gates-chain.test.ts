import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GATES } from '../scripts/release/gates.mjs';
import { runChain } from '../scripts/gates.mjs';

// `pnpm gates` — один ланцюг для виконавця й релізу: перелік тримає ОДИН масив
// (`scripts/release/gates.mjs`), порядок звіряється з `AGENTS.md`, а штамп пишеться й при падінні.
const ROOT = join(import.meta.dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

/** «Порядок гейтів» з `AGENTS.md`: `pnpm a → b → c` у бектиках (може бути в кілька рядків). */
function agentsOrder(): string[] {
  const text = read('AGENTS.md');
  const start = text.indexOf('**Порядок гейтів:**');
  expect(start).toBeGreaterThan(-1);
  const body = /`([^`]+)`/.exec(text.slice(start))![1]!;
  return body
    .replace(/\s+/g, ' ')
    .split('→')
    .map((step) => step.trim().replace(/^pnpm /, ''));
}

describe('перелік гейтів: AGENTS.md + pilot', () => {
  it('порядок = «Порядок гейтів» з AGENTS.md, а pilot — останній', () => {
    expect(GATES.map((gate) => gate.name)).toEqual([...agentsOrder(), 'pilot']);
  });

  it('release і gates беруть ОДИН масив: ні в `gates.mjs`, ні деінде копії переліку немає', () => {
    const gates = read('scripts/gates.mjs');
    expect(gates).toContain(
      "import { GATES, execGate } from './release/gates.mjs'",
    );
    expect(read('scripts/release.mjs')).toContain(
      "import { runGates } from './release/gates.mjs'",
    );
    expect(read('scripts/release/gates.mjs')).toMatch(
      /export function runGates[\s\S]*GATES\.entries\(\)/,
    );
    // Жоден інший скрипт не несе власного літерала гейта.
    const files = [
      ...readdirSync(join(ROOT, 'scripts')).filter((f) => f.endsWith('.mjs')),
      ...readdirSync(join(ROOT, 'scripts/release')).map((f) => `release/${f}`),
    ].filter((f) => f !== 'release/gates.mjs');
    for (const file of files)
      expect(read(`scripts/${file}`), file).not.toContain(
        "cmd: 'pnpm format:check'",
      );
  });
});

describe('runChain: штамп', () => {
  const gates = [
    { name: 'a', cmd: 'a' },
    { name: 'b', cmd: 'b' },
    { name: 'c', cmd: 'c' },
  ];
  const run = (failing?: string) => {
    const written: unknown[] = [];
    let t = 1000;
    const result = runChain({
      gates,
      exec: (gate: { name: string }) => {
        if (gate.name === failing) throw new Error(`впав ${gate.name}`);
      },
      head: 'abc123',
      now: () => (t += 10),
      write: (stamp) => written.push(structuredClone(stamp)),
    });
    return { ...result, written };
  };

  it('успіх: head, часи й усі гейти ok', () => {
    const { stamp, failure } = run();
    expect(failure).toBeNull();
    expect(stamp.head).toBe('abc123');
    expect(stamp.gates.map((g) => [g.name, g.ok])).toEqual([
      ['a', true],
      ['b', true],
      ['c', true],
    ]);
    expect(stamp.gates.every((g) => g.ms > 0)).toBe(true);
    expect(Date.parse(stamp.startedAt)).toBeLessThanOrEqual(
      Date.parse(stamp.finishedAt),
    );
  });

  it('падіння: ланцюг зупиняється, штамп має пройдене й червоний гейт, c не запускався', () => {
    const { stamp, failure, written } = run('b');
    expect((failure as Error).message).toBe('впав b');
    expect(stamp.gates.map((g) => [g.name, g.ok])).toEqual([
      ['a', true],
      ['b', false],
    ]);
    // Штамп записано після кожного гейту, остання версія — з червоним.
    expect(written).toHaveLength(2);
  });
});
