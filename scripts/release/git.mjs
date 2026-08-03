import { execSync } from 'node:child_process';

const run = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();

/** Робоче дерево має бути чистим: інакше в реліз-коміт заїде чуже. */
export function assertCleanTree() {
  const dirty = run('git status --porcelain');
  if (dirty) {
    throw new Error(
      `Робоче дерево не чисте — закоміть або відклади зміни:\n${dirty}`,
    );
  }
}

export function currentBranch() {
  return run('git rev-parse --abbrev-ref HEAD');
}

/**
 * Гілка для релізу.
 *
 * Реліз їде в `main` через PR, тож коміт версії не має лягати прямо в `main`:
 * якщо ми на ній — відгалужуємось у `release/vX.Y.Z`, інакше лишаємось на
 * поточній гілці (типовий випадок — доробка вже відкритого PR).
 */
export function ensureReleaseBranch(version, { log }) {
  const branch = currentBranch();
  if (branch !== 'main') {
    log(`Гілка: ${branch} (лишаємось на ній)`);
    return branch;
  }

  const releaseBranch = `release/v${version}`;
  run(`git checkout -b ${releaseBranch}`);
  log(`Гілка: ${releaseBranch} (відгалужено від main)`);
  return releaseBranch;
}

export function commitRelease(version) {
  run('git add -A');
  execSync(`git commit -q -F -`, {
    input: `chore(release): v${version}\n\nСинхронний бамп версії всіх публікованих пакетів ядра.\nПублікацію на npmjs підхопить workflow після мержу в main.\n`,
    encoding: 'utf8',
  });
  return run('git rev-parse --short HEAD');
}

/** Чи існує тег — щоб не намагатися перевипустити вже випущене. */
export function tagExists(version) {
  const tags = run('git tag --list');
  return tags.split('\n').includes(`v${version}`);
}
