import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  PUBLIC_MANIFEST_PATH,
  publicNames,
  resetPublicNamesCache,
} from '../public-names';

describe('publicNames', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'public-names-'));
    resetPublicNamesCache();
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('читає маніфест збірки', () => {
    mkdirSync(join(root, 'dist/client'), { recursive: true });
    writeFileSync(
      join(root, PUBLIC_MANIFEST_PATH),
      JSON.stringify(['favicon.ico', 'img']),
    );
    expect(publicNames(root)).toEqual(['favicon.ico', 'img']);
  });

  it('без маніфесту (dev, тест) — порожній перелік', () => {
    expect(publicNames(root)).toEqual([]);
  });
});
