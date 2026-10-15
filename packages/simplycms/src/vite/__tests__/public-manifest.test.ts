import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  PUBLIC_MANIFEST_FILE,
  listPublicNames,
  simplycmsPublicManifest,
  writePublicManifest,
} from '../public-manifest';

describe('маніфест public/', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'public-manifest-'));
    mkdirSync(join(root, 'public/img'), { recursive: true });
    writeFileSync(join(root, 'public/robots.txt'), 'x');
    writeFileSync(join(root, 'public/img/a.png'), 'x');
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('перелік — лише верхній рівень, без вмісту вкладених тек', () => {
    expect(listPublicNames(join(root, 'public'))).toEqual([
      'img',
      'robots.txt',
    ]);
  });

  it('немає теки public — порожній перелік', () => {
    expect(listPublicNames(join(root, 'nope'))).toEqual([]);
  });

  it('writePublicManifest пише JSON-масив у outDir', () => {
    const file = writePublicManifest(join(root, 'public'), join(root, 'out/c'));
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual([
      'img',
      'robots.txt',
    ]);
  });

  const run = (name: string) => {
    const plugin = simplycmsPublicManifest();
    plugin.writeBundle.call({
      environment: {
        name,
        config: {
          root,
          publicDir: join(root, 'public'),
          build: { outDir: 'dist/client' },
        },
      },
    });
  };

  it('плагін пише маніфест після клієнтського оточення', () => {
    run('client');
    expect(
      JSON.parse(
        readFileSync(join(root, 'dist/client', PUBLIC_MANIFEST_FILE), 'utf8'),
      ),
    ).toEqual(['img', 'robots.txt']);
  });

  it('серверне оточення маніфесту не пише', () => {
    run('ssr');
    expect(existsSync(join(root, 'dist/client', PUBLIC_MANIFEST_FILE))).toBe(
      false,
    );
  });
});
