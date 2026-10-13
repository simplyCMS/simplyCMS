/**
 * Твердження Gate CLI/TOOL про файли агента й шим хука старту сесії (К3-Е8, Task 20).
 *
 * Gate CLI дивиться на скаффолд з tarball-а (файли на місці, шим без `node_modules`
 * просить `pnpm install`); Gate TOOL — на встановлений скретч (шим доходить до CLI
 * і бачить етап, симлінки скілів резолвяться у скіли встановленого ядра).
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { envWithoutNodePath } from './env-without-node-path.mjs';
import {
  BLOCK_BEGIN,
  BLOCK_END,
} from '../../packages/cli/src/managed-block.mjs';

const SHIM = '.claude/hooks/session-start.mjs';

/** Файли агента, які скаффолд мусить покласти з tarball-а. */
const AGENT_FILES = ['AGENTS.md', 'CLAUDE.md', '.claude/settings.json', SHIM];

/**
 * Запуск шима як його запускає Claude Code: `node <шим>` у корені магазину.
 * Без NODE_PATH: «порожній» скаффолд інакше бачив би CLI монорепо.
 */
function runShim(storeDir) {
  const run = spawnSync('node', [join(storeDir, SHIM)], {
    cwd: storeDir,
    env: { ...envWithoutNodePath(), CLAUDE_PROJECT_DIR: storeDir },
    encoding: 'utf8',
    timeout: 30_000,
  });
  let context;
  try {
    context = JSON.parse(run.stdout).hookSpecificOutput.additionalContext;
  } catch {
    context = undefined;
  }
  return { code: run.status, context };
}

/**
 * Gate CLI: скаффолд несе `AGENTS.md` з керованим блоком, `CLAUDE.md` з імпортом
 * `@AGENTS.md`, запис хука й шим; шим на голому скаффолді просить `pnpm install`.
 */
export function checkAgentScaffold(storeDir) {
  for (const file of AGENT_FILES)
    if (!existsSync(join(storeDir, file)))
      return { ok: false, details: [`✗ скаффолд без ${file}`] };
  const agents = readFileSync(join(storeDir, 'AGENTS.md'), 'utf8');
  if (!agents.includes(BLOCK_BEGIN) || !agents.includes(BLOCK_END))
    return { ok: false, details: ['✗ в AGENTS.md немає керованого блоку'] };
  const claude = readFileSync(join(storeDir, 'CLAUDE.md'), 'utf8');
  if (!claude.split('\n').some((line) => line.trim() === '@AGENTS.md'))
    return { ok: false, details: ['✗ CLAUDE.md не імпортує @AGENTS.md'] };
  const shim = runShim(storeDir);
  if (shim.code !== 0 || !shim.context?.includes('pnpm install'))
    return {
      ok: false,
      details: [
        `✗ шим на голому скаффолді: код ${shim.code}, ` +
          `контекст «${shim.context}», очікувалось «pnpm install»`,
      ],
    };
  return {
    ok: true,
    details: [
      '✓ скаффолд: AGENTS.md з блоком, CLAUDE.md, хук і шим (→ pnpm install)',
    ],
  };
}

/** Каталоги скілів, які скаффолдер лінкує, — з їхніми записами. */
function skillLinks(storeDir) {
  return ['.agents/skills', '.claude/skills'].flatMap((dir) => {
    const path = join(storeDir, dir);
    return existsSync(path)
      ? readdirSync(path).map((name) => ({ dir, name, path: join(path, name) }))
      : [];
  });
}

/**
 * Gate TOOL: у встановленому скретчі шим дає код 0 і бачить етап `local`
 * (тобто дійшов до справжнього `status --hook`), а кожен симлінк скіла
 * резолвиться в теку скіла встановленого ядра — не просто існує.
 */
export function checkSessionHookOnScratch(storeDir) {
  const shim = runShim(storeDir);
  if (shim.code !== 0 || !shim.context?.includes('етап: local'))
    return {
      ok: false,
      details: [
        `✗ шим у скретчі: код ${shim.code}, контекст «${shim.context}», очікувався етап: local`,
      ],
    };
  const links = skillLinks(storeDir);
  if (links.length === 0)
    return { ok: false, details: ['✗ у скретчі немає симлінків скілів'] };
  for (const { dir, name, path } of links) {
    let target;
    try {
      target = realpathSync(path);
    } catch {
      return {
        ok: false,
        details: [`✗ ${dir}/${name}: симлінк не резолвиться`],
      };
    }
    const expected = realpathSync(
      join(storeDir, 'node_modules/simplycms/skills', name),
    );
    if (target !== expected)
      return {
        ok: false,
        details: [`✗ ${dir}/${name} → ${target}, очікувалось ${expected}`],
      };
  }
  return {
    ok: true,
    details: [
      `✓ скретч: шим → етап local, ${links.length} симлінків скілів живі`,
    ],
  };
}
