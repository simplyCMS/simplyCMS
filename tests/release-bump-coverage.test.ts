import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  currentVersion,
  readPublishableManifests,
} from '../scripts/release/bump.mjs';
import {
  bumpManifestVersions,
  manifestVersionDrift,
  manifestVersionFiles,
} from '../scripts/release/manifest-version.mjs';

// Гард синхронної моделі версій: реліз-бамп мусить бачити ВСІ публіковані
// пакети, інакше версії розійдуться на першому ж релізі після появи пакета.
describe('release bump: покриття манифестів', () => {
  it('бачить обидва unscoped-пакети і решту @simplycms/*', () => {
    const names = readPublishableManifests().map(
      ({ manifest }) => manifest.name,
    );
    expect(names).toContain('create-simplycms-store');
    // 🔴 Флагман К0 — unscoped, тож під фільтр scope він не підпадає й
    // потребує окремого асерту: пропущений тут, він мовчки випав би з бампу.
    expect(names).toContain('simplycms');
    // Поріг перехідний: К0 Task 2 злив дев'ять пакетів T0–T2 у флагман
    // (21 → 16), Task 3 замінить поріг ТОЧНИМ набором із пʼяти.
    expect(
      names.filter((n) => n.startsWith('@simplycms/')).length,
    ).toBeGreaterThanOrEqual(16);
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

  it('літерали сирців збігаються з версією пакетів (ЧИСТА перевірка)', () => {
    // 🔴 Тут кличеться саме `manifestVersionDrift`, а не письменник
    // `bumpManifestVersions`: письменник у ролі чекера при дрейфі МОВЧКИ
    // перезаписав би трекнутий сирець — правку розробника було б тихо
    // ревертнуто, а падіння не відтворилося б на другому прогоні.
    // Джерело еталона — currentVersion(): він сам гарантує синхронність.
    expect(manifestVersionDrift(currentVersion())).toEqual([]);
  });

  it('дрейф у фікстурі: чиста перевірка бачить його і НЕ чіпає файл', () => {
    const root = mkdtempSync(join(tmpdir(), 'drift-manifest-'));
    const dir = join(root, 'packages', 'simplycms-theme-aurora', 'src');
    mkdirSync(dir, { recursive: true });
    const path = join(dir, 'manifest.ts');
    const before =
      "const manifest = {\n  name: 'aurora',\n  version: '0.3.0',\n};\n";
    writeFileSync(path, before);

    process.chdir(root);
    expect(manifestVersionDrift('0.4.0')).toEqual([
      join('packages', 'simplycms-theme-aurora', 'src', 'manifest.ts'),
    ]);
    expect(readFileSync(path, 'utf8')).toBe(before);
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
