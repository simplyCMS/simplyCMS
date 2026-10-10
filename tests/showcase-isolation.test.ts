// Ізоляція сіду вітрини (С-2, DoD №4 плану 2026-10-08-showcase-seed): у публікованому
// коді ядра немає seed-гілок. Без цього гейта інваріант тримала б лише ручна команда
// `rg showcase packages/simplycms/src` — прапорець «якщо сідимо» в ядрі нічого б не
// червонив, бо тести сіду від такої гілки лише зеленіють.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
// Те, що їде в tarball ядра й шаблон магазину; `test-harness/` у `files` пакета немає.
const SHIPPED = [
  'packages/simplycms/src',
  'packages/simplycms/routes',
  'packages/simplycms/migrations',
  'packages/create-simplycms-store/template',
];

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

describe('сід вітрини не протікає в публікований код', () => {
  it('жоден файл ядра й шаблону не згадує showcase', () => {
    const hits = SHIPPED.flatMap((dir) => [...walk(join(ROOT, dir))])
      .filter((file) => /showcase/i.test(readFileSync(file, 'utf8')))
      .map((file) => relative(ROOT, file));
    expect(hits).toEqual([]);
  });
});
