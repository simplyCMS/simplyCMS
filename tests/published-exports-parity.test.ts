import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Інваріант публічної поверхні: набір subpath-ключів у dev-умові
// (`exports`, src — для внутрішнього workspace-споживання) має 1:1
// збігатися з publish-умовою (`publishConfig.exports`, dist). Це не дає
// внутрішньому src-споживанню відкрити шлях, якого не буде в
// опублікованому пакеті (і навпаки).

const PUBLISHED = [
  'objects',
  'domain',
  'data-supabase',
  'react-query',
  'runtime',
  'storefront',
] as const;

const pkgJson = (dir: string) =>
  JSON.parse(
    readFileSync(
      resolve(__dirname, '..', 'packages/simplycms', dir, 'package.json'),
      'utf8',
    ),
  ) as {
    name: string;
    exports?: Record<string, unknown>;
    publishConfig?: { registry?: string; exports?: Record<string, unknown> };
  };

describe('published packages: dev/publish exports parity', () => {
  for (const dir of PUBLISHED) {
    const json = pkgJson(dir);
    const dev = Object.keys(json.exports ?? {}).sort();
    const pub = Object.keys(json.publishConfig?.exports ?? {}).sort();

    it(`${json.name}: subpath keys match 1:1`, () => {
      expect(pub).toEqual(dev);
    });

    it(`${json.name}: publishes to npmjs`, () => {
      expect(json.publishConfig?.registry).toBe('https://registry.npmjs.org');
    });
  }
});
