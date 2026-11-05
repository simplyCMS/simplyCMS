import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { acquireTreeLock, LOCK_FILE } from '../scripts/tree-lock.mjs';

/** Замок прогону на дерево: один прогін-доказ за раз; мертвий власник не блокує. */
const dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'tree-lock-'));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const holder = (root: string, pid: number, label = 'pnpm gates') =>
  writeFileSync(
    join(root, LOCK_FILE),
    JSON.stringify({ pid, label, startedAt: '2026-11-04T10:00:00.000Z' }),
  );

describe('acquireTreeLock', () => {
  it('живий чужий pid — відмова з pid і назвою прогону', () => {
    const root = tmp();
    holder(root, process.ppid); // батьківський процес гарантовано живий
    expect(() => acquireTreeLock(root, 'pnpm live:smoke')).toThrow(
      new RegExp(`pnpm gates \\(pid ${process.ppid}`),
    );
  });

  it('мертвий pid — замок перехоплюється', () => {
    const root = tmp();
    holder(root, 2 ** 22 + 12345); // понад pid_max — ESRCH
    const release = acquireTreeLock(root, 'pnpm live:smoke');
    expect(JSON.parse(readFileSync(join(root, LOCK_FILE), 'utf8')).pid).toBe(
      process.pid,
    );
    release();
  });

  it('звільнення не чіпає чужий замок', () => {
    const root = tmp();
    const release = acquireTreeLock(root, 'pnpm gates');
    holder(root, process.ppid, 'інший прогін'); // замок перехопив хтось інший
    release();
    expect(readFileSync(join(root, LOCK_FILE), 'utf8')).toContain(
      'інший прогін',
    );
  });
});
