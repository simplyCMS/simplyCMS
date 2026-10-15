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
import { randomFillSync } from 'node:crypto';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { precompressAssets, precompressDir } from '../precompress';

const BIG = 'export const x = "повторюваний вміст";\n'.repeat(120);

describe('precompressDir', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'precompress-'));
    mkdirSync(join(dir, 'assets'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('великий файл дістає .br і .gz, що розпаковуються в ті самі байти; малий — ні', () => {
    writeFileSync(join(dir, 'assets/big.js'), BIG);
    writeFileSync(join(dir, 'assets/small.js'), 'a'.repeat(100));

    precompressDir(dir);

    const original = readFileSync(join(dir, 'assets/big.js'));
    expect(
      brotliDecompressSync(readFileSync(join(dir, 'assets/big.js.br'))),
    ).toEqual(original);
    expect(gunzipSync(readFileSync(join(dir, 'assets/big.js.gz')))).toEqual(
      original,
    );
    expect(existsSync(join(dir, 'assets/small.js.br'))).toBe(false);
    expect(existsSync(join(dir, 'assets/small.js.gz'))).toBe(false);
  });

  it('несжимний файл не отримує варіантів (вони були б більшими)', () => {
    const noise = Buffer.alloc(4096);
    randomFillSync(noise);
    writeFileSync(join(dir, 'assets/noise.js'), noise);
    precompressDir(dir);
    expect(existsSync(join(dir, 'assets/noise.js.br'))).toBe(false);
    expect(existsSync(join(dir, 'assets/noise.js.gz'))).toBe(false);
  });

  it('розширення поза списком не чіпає; повторний прогін не стискає .br/.gz удруге', () => {
    writeFileSync(join(dir, 'assets/photo.png'), BIG);
    writeFileSync(join(dir, 'assets/big.js'), BIG);
    precompressDir(dir);
    precompressDir(dir);
    expect(existsSync(join(dir, 'assets/photo.png.br'))).toBe(false);
    expect(existsSync(join(dir, 'assets/big.js.br.br'))).toBe(false);
  });
});

describe('precompressAssets', () => {
  const envOf = (name: string, root: string) => ({
    name,
    config: { root, build: { outDir: 'dist/client' } },
  });

  it('стискає outDir лише клієнтського оточення', () => {
    const root = mkdtempSync(join(tmpdir(), 'precompress-plugin-'));
    try {
      for (const sub of ['dist/client', 'dist/server']) {
        mkdirSync(join(root, sub), { recursive: true });
        writeFileSync(join(root, sub, 'a.js'), BIG);
      }
      const plugin = precompressAssets();
      plugin.closeBundle.call({ environment: envOf('ssr', root) });
      expect(existsSync(join(root, 'dist/client/a.js.br'))).toBe(false);
      plugin.closeBundle.call({ environment: envOf('client', root) });
      expect(existsSync(join(root, 'dist/client/a.js.br'))).toBe(true);
      expect(existsSync(join(root, 'dist/server/a.js.br'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
