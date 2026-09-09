import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Парність manifest-а референс-ТЕМ із їх package.json — дзеркало
 * `plugin-manifest-parity` (Фаза 4, Р6).
 *
 * 🔴 `version` у `ThemeManifest` — рядок-літерал, а модель версій ядра
 * СИНХРОННА: `bump.mjs` оновлює package.json і (з Фази 4) цей літерал, але
 * розсинхрон між ними ніхто інший не побачив би — рядок теми в таблиці
 * `themes` поїхав би з чужою версією.
 *
 * 🔴 Дискаверяться ЛИШЕ `packages/simplycms-theme-*`. `themes/default` під
 * parity свідомо НЕ підпадає: вона private, з власною версією, і є еталоном
 * copy-in-форми, а не учасником реліз-потяга.
 */
describe('референс-пакети тем: manifest ↔ package.json', () => {
  const dirs = readdirSync(join(REPO, 'packages'), { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() && entry.name.startsWith('simplycms-theme-'),
    )
    .map((entry) => entry.name)
    .sort();

  it('у репо є хоча б один референс-пакет теми', () => {
    expect(dirs.length).toBeGreaterThan(0);
  });

  describe.each(dirs)('пакет "%s"', (dir) => {
    it('version дорівнює version пакета; name збігається з текою; displayName непорожній', async () => {
      const manifestJson = JSON.parse(
        readFileSync(join(REPO, 'packages', dir, 'package.json'), 'utf8'),
      ) as { name: string; version: string };
      const module = (await import(
        /* @vite-ignore */ pathToFileURL(
          join(REPO, 'packages', dir, 'src', 'manifest.ts'),
        ).href
      )) as {
        default: { name: string; displayName?: string; version: string };
      };
      const manifest = module.default;

      expect(manifest.version).toBe(manifestJson.version);
      // Канонічне імʼя = тека без префікса = хвіст імені пакета: на цьому
      // тримаються ключ конфігу (deriveKey), `name` рядка в таблиці `themes`
      // і резолв активної теми в `getActiveThemeSSR`.
      const canonical = dir.slice('simplycms-theme-'.length);
      expect(manifest.name).toBe(canonical);
      expect(manifestJson.name).toBe(`@simplycms/theme-${canonical}`);
      // displayName — те, що бачить адмін у списку тем (амендмент спеки §6).
      expect(manifest.displayName?.trim()).toBeTruthy();
    });
  });
});
