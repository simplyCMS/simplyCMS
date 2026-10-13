import { readFileSync, writeFileSync } from 'node:fs';
import { distTagFor } from './dist-tag.mjs';

const CREATE_README = 'packages/create-simplycms-store/README.md';
// Лише команда створення: тег стоїть одразу після імені пакета.
const CREATE_CMD_RE = /pnpm create simplycms-store(?:@[\w.-]+)?(?=[\s`.,)])/g;

/**
 * Проставити в тексті README тег команди `pnpm create simplycms-store` за
 * версією, що виходить: пререліз → `@next` (під ним він і публікується),
 * стабільна → без тега. `@latest` не пишемо: це дефолт, а зашитий тег
 * старів би мовчки.
 * @param {string} text
 * @param {string} version
 */
export function retagCreateReadme(text, version) {
  const suffix = distTagFor(version) === 'next' ? '@next' : '';
  return text.replace(CREATE_CMD_RE, `pnpm create simplycms-store${suffix}`);
}

/** Крок бампу: README пакета на npm іде за версією, а не за пам'яттю релізера. */
export function bumpCreateReadmeTag(version) {
  const source = readFileSync(CREATE_README, 'utf8');
  const next = retagCreateReadme(source, version);
  if (next !== source) writeFileSync(CREATE_README, next);
}
