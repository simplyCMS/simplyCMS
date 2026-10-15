#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { currentVersion } from './bump.mjs';

/**
 * npm-тег публікації: пре-реліз (`1.0.0-rc.N`) → `next`, стабільний → `latest`.
 * Без цього `pnpm publish` ставить `latest` і RC стає «останньою» версією для
 * кожного, хто ставить пакет без версії.
 * @param {string} version
 * @returns {'latest' | 'next'}
 */
export function distTagFor(version) {
  return version.includes('-') ? 'next' : 'latest';
}

// CLI-режим для workflow: `node scripts/release/dist-tag.mjs --print` друкує
// тег поточної версії пакетів — той самий шлях, що й у `pnpm release`.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (!process.argv.includes('--print')) {
    console.error('Використання: node scripts/release/dist-tag.mjs --print');
    process.exit(1);
  }
  // Тег друкується лише при успіху: помилка → ненульовий exit і ПОРОЖНІЙ stdout,
  // щоб workflow не підставив сміття в `--tag` (guard у кроці Publish — другий замок).
  let tag;
  try {
    tag = distTagFor(currentVersion());
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  console.log(tag);
}
