#!/usr/bin/env node
/**
 * Підготовка релізу ядра однією командою.
 *
 *   pnpm release 0.2.0          (або пререліз: pnpm release 1.0.0-rc.1)
 *
 * Що робить:
 *   1. гарди — чисте дерево, коректна й більша версія, тег ще не існує;
 *   2. синхронний бамп версії всіх публікованих пакетів;
 *   3. повний прогін гейтів у канонічному порядку (перший червоний — стоп);
 *   4. коміт `chore(release): vX.Y.Z`.
 *
 * Далі — вручну: `git push` і PR у `main`. Мерж у `main` запускає workflow
 * `publish-packages`, який публікує на npmjs те, чого ще немає в реєстрі.
 *
 * 🔴 Скрипт свідомо НЕ пушить і НЕ створює PR: реліз — рішення людини, і
 * останній погляд на діф має лишатися за нею.
 */
import {
  assertNewerVersion,
  bumpTo,
  currentVersion,
  VERSION_RE,
} from './release/bump.mjs';
import { bumpCreateReadmeTag } from './release/readme-tag.mjs';
import { runGates } from './release/gates.mjs';
import {
  assertCleanTree,
  commitRelease,
  ensureReleaseBranch,
  tagExists,
} from './release/git.mjs';

const log = (message) => console.log(message);
const fail = (message) => {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
};

const version = process.argv[2];

try {
  if (!version || !VERSION_RE.test(version)) {
    fail(
      `Вкажи версію у форматі X.Y.Z або X.Y.Z-rc.N:  pnpm release 0.2.0\n` +
        `  Отримано: ${version ?? '(нічого)'}`,
    );
  }

  const from = currentVersion();

  assertNewerVersion(version, from);

  if (tagExists(version)) {
    fail(`Тег v${version} уже існує — цю версію вже випускали.`);
  }

  assertCleanTree();

  log(`\n▸ Реліз ${from} → ${version}\n`);

  const branch = ensureReleaseBranch(version, { log });

  const { updated, skipped } = bumpTo(version);
  bumpCreateReadmeTag(version);
  log(`Версію проставлено пакетам: ${updated.length}`);
  if (skipped.length) log(`  (пропущено, вже ${version}: ${skipped.length})`);

  log(`\n▸ Гейти`);
  runGates({ log });
  log(`  усі зелені`);

  const sha = commitRelease(version);

  log(`\n✔ Готово. Коміт ${sha} на гілці ${branch}\n`);
  log(`Далі:`);
  log(`  git push -u origin ${branch}`);
  log(`  gh pr create --base main --title "Реліз v${version}"`);
  log(
    `\nПісля мержу в main workflow \`publish-packages\` опублікує пакети на npmjs.`,
  );
  log(
    `Пакети, чия версія вже в реєстрі, пропускаються — повторний мерж безпечний.\n`,
  );
} catch (error) {
  fail(error.message);
}
