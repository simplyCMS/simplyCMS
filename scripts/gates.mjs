#!/usr/bin/env node
/**
 * `pnpm gates` — повний ланцюг гейтів ОДНІЄЮ командою, зі штампом `.gates-stamp.json`.
 *
 * Перелік — той самий, що в `pnpm release` (`scripts/release/gates.mjs`, `GATES`): без
 * копії, разом із повним `pilot`. Ланцюг, який виконавець «ганяв би руками», розходиться
 * з релізним; штамп дає звіту доказ: `head` (коміт, на якому ганяли) + `ok` кожного гейту.
 *
 * 🔴 Брудне дерево — відмова: штамп із `head` доводить стан коміту лише тоді, коли дерево
 * чисте (незакомічена правка зробила б штамп неправдою). Штамп пишеться ПІСЛЯ кожного
 * гейту, тож і при падінні в ньому те, що встигло пройти.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GATES, execGate } from './release/gates.mjs';

export const STAMP_FILE = '.gates-stamp.json';

/**
 * @param {{ gates: typeof GATES; exec: (gate: (typeof GATES)[number]) => void;
 *   head: string; now: ()=>number; write: (stamp:object)=>void; statusAfter?: ()=>string; log?: (line:string)=>void }} deps
 * @returns {{ stamp: { head: string; startedAt: string; finishedAt: string; gates: {name:string,ok:boolean,ms:number}[]; dirtyAfter?: string[] }; failure: unknown }}
 */
export function runChain({
  gates,
  exec,
  head,
  now,
  write,
  statusAfter = () => '',
  log = () => {},
}) {
  const stamp = {
    head,
    startedAt: new Date(now()).toISOString(),
    finishedAt: '',
    gates: [],
  };
  let failure = null;
  for (const [index, gate] of gates.entries()) {
    log(`  [${index + 1}/${gates.length}] ${gate.name}…`);
    const t0 = now();
    let ok = true;
    try {
      exec(gate);
    } catch (error) {
      ok = false;
      failure = error;
    }
    stamp.gates.push({ name: gate.name, ok, ms: now() - t0 });
    stamp.finishedAt = new Date(now()).toISOString();
    write(stamp);
    if (!ok) break;
  }
  // `build` перегенеровує закомічений `src/routeTree.gen.ts` тощо: дерево, брудне ПІСЛЯ
  // прогону, робить штамп із `head` неправдою про стан коміту.
  const dirtyAfter = statusAfter()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (dirtyAfter.length > 0) {
    stamp.dirtyAfter = dirtyAfter;
    failure ??= new Error(
      `дерево брудне ПІСЛЯ прогону (гейти змінили закомічені файли):\n${dirtyAfter.join('\n')}`,
    );
  }
  stamp.finishedAt = new Date(now()).toISOString();
  write(stamp);
  return { stamp, failure };
}

function main() {
  const root = join(import.meta.dirname, '..');
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const dirty = git('status', '--porcelain');
  if (dirty) {
    console.error(
      `❌ gates: дерево брудне — закоміть або прибери зміни, штамп доводить лише чистий коміт:\n${dirty}`,
    );
    process.exit(1);
  }
  const { stamp, failure } = runChain({
    gates: GATES,
    exec: execGate,
    head: git('rev-parse', 'HEAD'),
    now: Date.now,
    write: (s) =>
      writeFileSync(join(root, STAMP_FILE), `${JSON.stringify(s, null, 2)}\n`),
    statusAfter: () => git('status', '--porcelain'),
    log: console.log,
  });
  if (failure) {
    console.error(`\n❌ ${failure.message}\nШтамп: ${STAMP_FILE}`);
    process.exit(1);
  }
  console.log(
    `\n✅ Усі ${stamp.gates.length} гейтів зелені на ${stamp.head.slice(0, 8)}. Штамп: ${STAMP_FILE}`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) main();
