// Doctor №18: файли агента. Окремий модуль, щоб doctor-fs-checks.mjs не ріс понад межу.
import {
  describeAgentDrift,
  describeRecommendedPermissions,
  inspectAgentFiles,
  isShimMissing,
} from './agent-files.mjs';
import { claudeVersionWarning } from './claude-version.mjs';

/** @typedef {import('./ui.mjs').Check} Check */

/**
 * №18: керований блок `AGENTS.md` і запис хука старту сесії; розбіжність — warn
 * (`simplycms update`). Дозволи `update` не зливає — показуються тут. Версію Claude
 * Code питає лише doctor (`claudeCheckEnv`): у `status --hook` хук уже запустився, а
 * `claude --version` гальмував би старт сесії.
 * @param {{ storeRoot: string; claudeCheckEnv?: NodeJS.ProcessEnv }} ctx
 * @returns {Check}
 */
export function checkAgentFiles({ storeRoot, claudeCheckEnv }) {
  const id = 'agent-files';
  const title = 'Файли агента: керований блок AGENTS.md і хук старту сесії';
  const state = inspectAgentFiles(storeRoot);
  if (state.block === null) {
    const details =
      'node_modules/simplycms/agent відсутня — ядро не встановлене або стара версія';
    return { id, title, status: 'skip', details };
  }
  const problems = [
    ...(state.hook.status === 'invalid' ? [state.hook.error] : []),
    ...describeAgentDrift(state),
  ];
  const outdated = claudeCheckEnv ? claudeVersionWarning(claudeCheckEnv) : null;
  const lines = describeRecommendedPermissions(storeRoot);
  if (problems.length === 0 && outdated === null)
    return { id, title, status: 'ok', details: lines.join('\n') || undefined };
  // Шим — host-файл: його пише лише `--write`.
  const flag = isShimMissing(state) ? ' --write' : '';
  const fix = `${problems.join('; ')}. Полагодь: pnpm simplycms update${flag}`;
  const parts = [problems.length > 0 && fix, outdated, ...lines];
  return {
    id,
    title,
    status: 'warn',
    details: parts.filter(Boolean).join('\n'),
  };
}
