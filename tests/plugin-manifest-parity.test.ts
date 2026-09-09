import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Парність manifest-а референс-пакетів плагінів із їх package.json.
 *
 * 🔴 Version у `definePlugin` — рядок-літерал, а модель версій СИНХРОННА:
 * `bump.mjs` оновлює package.json, але не сирці. Без цього гарда перший же
 * реліз розсинхронізував би версію в БД-рядку плагіна з реєстровою
 * (знахідка рев'ю Фази 3) — той самий клас захисту, що CORE_VERSION-тест
 * у objects.
 */
describe('референс-пакети плагінів: manifest ↔ package.json', () => {
  const dirs = readdirSync(join(REPO, 'packages'), { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() && entry.name.startsWith('simplycms-plugin-'),
    )
    .map((entry) => entry.name);

  it('у репо є хоча б один референс-пакет', () => {
    expect(dirs.length).toBeGreaterThan(0);
  });

  describe.each(dirs)('пакет "%s"', (dir) => {
    it('version у definePlugin дорівнює version пакета; name збігається з текою', async () => {
      const manifestJson = JSON.parse(
        readFileSync(join(REPO, 'packages', dir, 'package.json'), 'utf8'),
      ) as { name: string; version: string };
      const module = (await import(
        /* @vite-ignore */ pathToFileURL(
          join(REPO, 'packages', dir, 'src', 'index.ts'),
        ).href
      )) as { default: { manifest: { name: string; version: string } } };

      expect(module.default.manifest.version).toBe(manifestJson.version);
      // Канонічне імʼя = тека без префікса = хвіст імені пакета: на цьому
      // тримаються конфіг-ключ (deriveKey), префікс plg_* і usePluginConfig.
      const canonical = dir.slice('simplycms-plugin-'.length);
      expect(module.default.manifest.name).toBe(canonical);
      expect(manifestJson.name).toBe(`@simplycms/plugin-${canonical}`);
    });
  });
});
