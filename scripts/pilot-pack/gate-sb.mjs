/**
 * Gate SB — що вклеєно в серверний бандл скретч-магазину (К3-Е7, Task 11).
 * Джерело — `bundle-stats.ssr.json` (той самий міні-плагін, що й для Gate C).
 * Логіка й обґрунтування — `server-bundle.mjs`; дані — `server-bundle-allowlist.mjs`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  checkRequestContextSingle,
  checkServerBundle,
} from './server-bundle.mjs';
import { SERVER_BUNDLE_ALLOWLIST } from './server-bundle-allowlist.mjs';

/** @returns {{ ok: boolean; details: string[] }} */
export function gateServerBundle(storeDir) {
  const stats = JSON.parse(
    readFileSync(join(storeDir, 'bundle-stats.ssr.json'), 'utf8'),
  );
  const bundle = checkServerBundle(stats, SERVER_BUNDLE_ALLOWLIST);
  const context = checkRequestContextSingle(stats);
  return {
    ok: bundle.ok && context.ok,
    details: [...bundle.details, ...context.details],
  };
}
