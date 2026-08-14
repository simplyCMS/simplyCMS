import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readPublishableManifests } from '../scripts/release/bump.mjs';
import {
  bumpManifestVersions,
  manifestVersionFiles,
} from '../scripts/release/manifest-version.mjs';

// Гард синхронної моделі версій: реліз-бамп мусить бачити ВСІ публіковані
// пакети, інакше версії розійдуться на першому ж релізі після появи пакета.
describe('release bump: покриття манифестів', () => {
  it('бачить create-simplycms-store і всі @simplycms/*', () => {
    const names = readPublishableManifests().map(
      ({ manifest }) => manifest.name,
    );
    expect(names).toContain('create-simplycms-store');
    expect(
      names.filter((n) => n.startsWith('@simplycms/')).length,
    ).toBeGreaterThanOrEqual(21);
  });

  it('версія одна на всіх (синхронна модель)', () => {
    const versions = new Set(
      readPublishableManifests().map(({ manifest }) => manifest.version),
    );
    expect(versions.size).toBe(1);
  });
});

/**
 * Р13 Фази 4: `bumpTo` мусить переписувати ще й version-літерали в сирцях
 * референс-пакетів. Без цього перший `pnpm release` падав би на власних
 * гейтах — parity-тести маніфестів червоніли б одразу після бампа.
 */
describe('release bump: version-літерали маніфестів', () => {
  const cwd = process.cwd();
  afterEach(() => process.chdir(cwd));

  it('дискаверить сирці обох конвенцій референс-пакетів', () => {
    const files = manifestVersionFiles();
    expect(files).toContain('packages/simplycms-plugin-faq/src/index.ts');
    expect(files).toContain(
      'packages/simplycms-theme-solarstore/src/manifest.ts',
    );
  });

  it('на поточній версії — no-op, і жоден літерал не «загубився»', () => {
    // Виклик із чинною версією нічого не пише, але проганяє строгий regex по
    // КОЖНОМУ файлу: 0 або 2+ збіги — виняток. Тобто зелений тест і є доказ,
    // що формат літералів не поїхав.
    const version = readPublishableManifests()[0].manifest.version;
    expect(bumpManifestVersions(version)).toEqual([]);
  });

  it('переписує літерал у фікстурі, зберігаючи відступ', () => {
    const root = mkdtempSync(join(tmpdir(), 'bump-manifest-'));
    const dir = join(root, 'packages', 'simplycms-theme-aurora', 'src');
    mkdirSync(dir, { recursive: true });
    const path = join(dir, 'manifest.ts');
    writeFileSync(
      path,
      "const manifest = {\n  name: 'aurora',\n  version: '0.3.0',\n  engines: { simplycms: '>=0.3.0' },\n};\n",
    );

    process.chdir(root);
    expect(bumpManifestVersions('0.4.0')).toEqual([
      join('packages', 'simplycms-theme-aurora', 'src', 'manifest.ts'),
    ]);
    const source = readFileSync(path, 'utf8');
    expect(source).toContain("  version: '0.4.0',");
    // Діапазон сумісності — не версія пакета: строгий патерн його не чіпає.
    expect(source).toContain("engines: { simplycms: '>=0.3.0' }");
  });

  it('немає літерала — гучна помилка, а не тихий пропуск', () => {
    const root = mkdtempSync(join(tmpdir(), 'bump-manifest-'));
    const dir = join(root, 'packages', 'simplycms-plugin-broken', 'src');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'index.ts'),
      "export default definePlugin({ name: 'broken', version: VERSION });\n",
    );

    process.chdir(root);
    expect(() => bumpManifestVersions('0.4.0')).toThrow(
      /version-літералів маніфесту/,
    );
  });
});
