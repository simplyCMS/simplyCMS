// Звірка магазину з каноном ЦІЄЇ версії CLI й ядра — друга половина `simplycms
// update` після (можливого) install: host-файли, лінки скілів, керований блок
// `AGENTS.md`, запис хука, тека міграцій. Окремий модуль: install і передача
// керування новому CLI (Р21) живуть в update.mjs, тут — лише стан теки магазину.
import { missingStoreMigrationsDir } from './db-diff.mjs';
import { readStoreManifest } from './context.mjs';
import {
  describeAgentDrift,
  inspectAgentFiles,
  writeAgentFiles,
} from './agent-files.mjs';
import {
  CANON_HOST_DIR,
  findHostDrift,
  writeHostFiles,
} from './host-drift.mjs';
import { MANUAL_BLOCK_STEPS } from './managed-block.mjs';
import { pgUpdateHint } from './pg-peer.mjs';
import { inspectSkillLinks, syncSkillLinks } from './skill-links.mjs';
import { finish, say, showSteps } from './ui.mjs';

/** Лінки скілів: `--check` лише звітує, інакше — тихий ремонт (як і раніше). */
function linkProblems(storeRoot, check) {
  if (!check) {
    syncSkillLinks(storeRoot);
    return [];
  }
  const { missing, orphaned } = inspectSkillLinks(storeRoot);
  return [
    ...missing.map((link) => `немає лінка ${link}`),
    ...orphaned.map((link) => `осиротілий лінк ${link}`),
  ];
}

/** Файли агента: запис (крім `--check`); маркери без ремонту — інструкція власнику. */
function agentStep(storeRoot, check) {
  const state = inspectAgentFiles(storeRoot);
  if (state.hook.status === 'invalid') {
    say.error(state.hook.error);
    return { failed: true, problems: [] };
  }
  if (state.block === null)
    say.info(
      'Встановлене ядро не везе agent/ — керований блок AGENTS.md не звіряю.',
    );
  if (state.block?.status === 'missing' || state.block?.status === 'damaged')
    showSteps(
      MANUAL_BLOCK_STEPS,
      'Керований блок AGENTS.md: update нічого не записав',
    );
  if (check) return { failed: false, problems: describeAgentDrift(state) };
  const written = writeAgentFiles(storeRoot, state);
  if (written.length > 0)
    say.success(`Оновлено файли агента: ${written.join(', ')}`);
  return { failed: false, problems: [] };
}

/**
 * @param {string} storeRoot
 * @param {{ check: boolean; write: boolean }} options
 * @returns {number} код виходу: `--check` — 0/3/1 (Е8-О8); без прапорців дрейф host-файлів — 1
 */
export function reconcileStore(storeRoot, { check, write }) {
  // Драйвер `pg` належить магазину: update його не переписує, лише підказує.
  const pgHint = pgUpdateHint(storeRoot, readStoreManifest(storeRoot));
  if (pgHint) say.warn(pgHint);
  const problems = linkProblems(storeRoot, check);
  const { files, drifted } = findHostDrift(storeRoot);
  if (files.length === 0)
    throw new Error(
      `Канонічна тека host/ пакета CLI порожня або відсутня (${CANON_HOST_DIR}) — ` +
        'інсталяція CLI бита, перевстанови @simplycms/cli',
    );
  let exitCode = 0;
  if (drifted.length === 0) {
    say.success('Host-файли збігаються з каноном.');
  } else if (write) {
    writeHostFiles(storeRoot, drifted);
    say.success(`Перезаписано канонічними версіями: ${drifted.join(', ')}`);
    showSteps([
      'git diff     # ревʼю перезаписаних host-файлів',
      'pnpm build   # перезбірка магазину',
    ]);
  } else {
    say.error(`Дрейф host-файлів проти канону: ${drifted.join(', ')}`);
    showSteps([
      'pnpm simplycms update --write   # перезаписати канонічними версіями',
    ]);
    if (check) problems.push(`дрейф host-файлів: ${drifted.join(', ')}`);
    else exitCode = 1;
  }
  const agent = agentStep(storeRoot, check);
  problems.push(...agent.problems);
  if (problems.length > 0) {
    say.error(`Розбіжності: ${problems.join('; ')}`);
    exitCode = 3;
  }
  // Тека міграцій перевіряється на кожній гілці: жодна з них не мовчить про неї.
  const missingMigrations = missingStoreMigrationsDir(storeRoot);
  if (missingMigrations) say.error(missingMigrations);
  if (missingMigrations || agent.failed) exitCode = 1;
  finish(
    exitCode === 0
      ? 'Готово.'
      : exitCode === 3
        ? 'Є розбіжності (--check).'
        : 'Є помилки.',
  );
  return exitCode;
}
