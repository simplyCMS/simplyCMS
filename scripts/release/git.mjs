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

/**
 * Чи існує тег `vX.Y.Z` — щоб не намагатися перевипустити вже випущене.
 *
 * 🔴 Перевіряємо REMOTE (`git ls-remote`), не локальний `git tag --list`:
 * у свіжому клоні (і в кожному щойно зачекаутченому раннері CI) локальний
 * список тегів порожній, поки теги явно не пофетчено, — саме тому старий
 * варіант гарду був сліпий і пропустив би повторний випуск уже виданої
 * версії. `git ls-remote --exit-code` читає джерело правди напряму:
 * exit-код 2 означає «remote відповів, збігів нема», будь-який інший
 * ненульовий код — проблему з доступом до самого remote.
 *
 * 🔴 Якщо remote недосяжний — падаємо з чіткою помилкою, а НЕ відкочуємось
 * тихо на локальні теги. Такий фолбек виглядав би як «розумна деградація»,
 * але насправді відтворює рівно той дефект, який ми лагодимо: локальний
 * список у свіжому клоні завжди порожній, тож «тихо перейти на локальне»
 * означає «тихо завжди казати false» — гард знову сліпий, тільки непомітно.
 * Явна помилка незручніша за мовчазне продовження, але значно безпечніша за
 * хибний «тегу нема», який дозволив би пропустити дубль релізу.
 */
export function tagExists(version) {
  const tag = `refs/tags/v${version}`;
  try {
    execSync(`git ls-remote --exit-code --tags origin ${tag}`, {
      encoding: 'utf8',
      timeout: 15_000,
    });
    return true;
  } catch (error) {
    if (error.status === 2) {
      return false; // remote відповів: тега з такою назвою немає
    }
    const detail = error.stderr?.trim() || error.message;
    throw new Error(
      `Не вдалось перевірити тег ${tag} у remote 'origin': ${detail}\n` +
        `Гард навмисно не відкочується на локальні теги (це і є дефект, який лагодимо) — перевір мережу/доступ до origin і спробуй ще раз.`,
    );
  }
}
