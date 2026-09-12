/**
 * Gate IP — Import Protection ВАЛИТЬ збірку магазину на витоку (К2-Е0, T-2).
 *
 * 🔴 Це поведінковий доказ межі клієнт/сервер у РЕАЛЬНОМУ магазині з
 * tarball-ів: юніт `tests/import-protection-wiring.test.ts` перевіряє дані
 * й підключення, а що плагін справді зупиняє збірку — лише прогін. Дві
 * форми витоку, бо їх ловлять РІЗНІ механізми плагіна:
 *   • bare `simplycms/db` — `specifiers`;
 *   • відносна втеча в `node_modules/simplycms/src/db/client` — `files` з
 *     нашим `excludeFiles` (дефолтний виключав би весь node_modules).
 *
 * 🔴 Експорт у відносній формі — РЕАЛЬНИЙ (`resolveDatabaseUrl`): з
 * вигаданим ім'ям Rolldown падає на `MISSING_EXPORT` РАНІШЕ за межу, і
 * червона збірка доводить не те (спіймано на рев'ю 2026-09-03).
 *
 * 🔴 Vite спорожнює `dist/` на старті збірки, тож після червоних збірок
 * скретч перезбирається начисто — інакше `--keep` лишив би порожній dist.
 *
 * 🔴 Чистий ре-білд захоплює вивід: це єдине місце, де конфіг ШАБЛОНУ реально
 * збирає магазин, тож попередження Vite про `__dirname` у конфізі (T-4,
 * `configLoader: 'native'`) ловляться саме тут, а не лише в монорепо.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// 🔴 Імʼя роута — БЕЗ префікса `__`: подвійне підкреслення в конвенції
// TanStack Router означає pathless-роут, тож `__leak.tsx` дістав би повний
// шлях `/` і генератор упав би на конфлікті з індексом вітрини ЩЕ ДО
// Import Protection — червона збірка доводила б не те (вимір 2026-09-12).
const LEAK_ROUTE = 'src/routes/my/leak-probe.tsx';
const MARKER = '[import-protection] Import denied';

// 🔴 `expect` — не косметика: дві форми існують саме тому, що їх ловлять
// РІЗНІ механізми плагіна. Без перевірки, ЯКИЙ саме патерн спрацював, гейт
// зеленів би, навіть якби обидві форми ловив один `specifiers`, — тобто
// доводив би одне замість двох.
const LEAKS = [
  {
    label: 'bare simplycms/db (specifiers)',
    expect: 'Denied by specifier pattern',
    source: `import { createFileRoute } from '@tanstack/react-router';
import { withActor } from 'simplycms/db';
export const Route = createFileRoute('/my/leak-probe')({
  component: () => <div>{typeof withActor}</div>,
});
`,
  },
  {
    label:
      'відносна втеча в node_modules/simplycms/src/db/client (files + excludeFiles)',
    expect: 'Denied by file pattern',
    source: `import { createFileRoute } from '@tanstack/react-router';
import { resolveDatabaseUrl } from '../../../node_modules/simplycms/src/db/client';
export const Route = createFileRoute('/my/leak-probe')({
  component: () => <div>{typeof resolveDatabaseUrl}</div>,
});
`,
  },
];

/** `vite build`, який МУСИТЬ упасти; віддає stderr+stdout для пошуку маркера. */
function buildExpectingFailure(storeDir) {
  try {
    execFileSync(join(storeDir, 'node_modules/.bin/vite'), ['build'], {
      cwd: storeDir,
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'production' },
      encoding: 'utf8',
    });
    return { failed: false, output: '' };
  } catch (error) {
    return {
      failed: true,
      output: `${error.stdout ?? ''}${error.stderr ?? ''}`,
    };
  }
}

/** Чиста `vite build`: падіння тут — поламка пілота, не доказ; повертає stdout+stderr. */
function buildCapturing(storeDir) {
  const result = spawnSync(
    join(storeDir, 'node_modules/.bin/vite'),
    ['build'],
    {
      cwd: storeDir,
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'production' },
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `чистий ре-білд скретча впав:\n${result.stdout}${result.stderr}`,
    );
  }
  return `${result.stdout}${result.stderr}`;
}

/**
 * @param {string} storeDir
 * @returns {{ ok: boolean; details: string[] }}
 */
export function gateImportProtection(storeDir) {
  const details = [];
  let ok = true;
  const routeFile = join(storeDir, LEAK_ROUTE);
  mkdirSync(join(storeDir, 'src/routes/my'), { recursive: true });

  try {
    for (const leak of LEAKS) {
      writeFileSync(routeFile, leak.source);
      const { failed, output } = buildExpectingFailure(storeDir);
      const denied = failed && output.includes(MARKER);
      // Червона збірка без маркера — це НЕ доказ межі, а інша поламка.
      const byExpected = denied && output.includes(leak.expect);
      const passed = byExpected;
      details.push(
        `${passed ? 'OK  ' : 'FAIL'} ${leak.label} — ${
          failed
            ? denied
              ? byExpected
                ? `збірка впала з маркером (${leak.expect})`
                : `збірка впала з маркером, але НЕ через «${leak.expect}»`
              : 'збірка впала БЕЗ маркера Import Protection'
            : 'збірка ПРОЙШЛА — витік не зупинено'
        }`,
      );
      if (!passed) ok = false;
    }
  } finally {
    rmSync(routeFile, { force: true });
    // Чистий ре-білд: Vite спорожнив dist на кожній червоній збірці.
    const rebuilt = buildCapturing(storeDir);
    details.push('OK   роут-витік прибрано, скретч перезібрано начисто');
    // Попередження Vite про `__dirname`/імпорт без розширення у конфізі
    // магазину — регрес T-4, який монорепний `pnpm build` не бачить.
    const warned = rebuilt.includes("unsupported by `configLoader: 'native'`");
    details.push(
      `${warned ? 'FAIL' : 'OK  '} конфіг магазину без попереджень Vite про configLoader: 'native'`,
    );
    if (warned) ok = false;
  }
  return { ok, details };
}
