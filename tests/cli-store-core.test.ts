import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { importFromStore } from '../packages/cli/src/store-core.mjs';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true });
});

/** Магазин із пакетом `fake-core`, що має лише `types` та `import`. */
function storeWithFakeCore(exportsMap: Record<string, unknown>): string {
  const root = mkdtempSync(join(tmpdir(), 'store-core-'));
  roots.push(root);
  const pkg = join(root, 'node_modules', 'fake-core');
  mkdirSync(join(pkg, 'dist'), { recursive: true });
  writeFileSync(join(root, 'package.json'), '{}');
  writeFileSync(
    join(pkg, 'package.json'),
    JSON.stringify({ name: 'fake-core', type: 'module', exports: exportsMap }),
  );
  writeFileSync(join(pkg, 'dist/index.js'), 'export const marker = 42;\n');
  return root;
}

describe('importFromStore', () => {
  it('субшлях лише з умовою import (як опублікований simplycms/migrate) резолвиться', async () => {
    const root = storeWithFakeCore({
      './migrate': { types: './dist/index.d.ts', import: './dist/index.js' },
    });
    const mod = await importFromStore(root, 'fake-core/migrate');
    expect(mod.marker).toBe(42);
  });

  it('субшлях, якого немає в exports, — зрозуміла помилка, а не тиха підміна', async () => {
    const root = storeWithFakeCore({
      './migrate': { import: './dist/index.js' },
    });
    await expect(importFromStore(root, 'fake-core/other')).rejects.toThrow(
      /не експортує \.\/other/,
    );
  });

  it('пакета немає в магазині — помилка з назвою пакета', async () => {
    const root = storeWithFakeCore({});
    await expect(importFromStore(root, 'no-such-pkg/x')).rejects.toThrow(
      /no-such-pkg/,
    );
  });
});
