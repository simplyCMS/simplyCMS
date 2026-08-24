import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Структурний гард тулчейна декларацій (розтин OOM 2026-08-24).
//
// 🔴 Що саме стережемо. Вендорений rollup-plugin-dts (dts-механізм tsup)
// створює окрему повну ts.Program на КОЖНУ теку entry профілю і тримає їх
// усі живими: 228 entry у 34 теках давали 36 програм і 9 ГБ heap. Тому
// декларації пакета ядра НАЗАВЖДИ емітить `tsc -p tsconfig.dts.json`, а
// збірка йде під кепом памʼяті (scripts/build-packages.mjs). Поведінковий
// бік (реальний прогін під кепом) перевіряє сам крок build:packages у
// кожному контурі; тут — дешеві структурні асерти, що ламаються ПЕРШИМИ,
// коли хтось «повертає як було».

const root = resolve(import.meta.dirname, '..');
const read = (rel: string): string => readFileSync(resolve(root, rel), 'utf8');

describe('тулчейн декларацій: dts поза tsup', () => {
  it('жоден профіль tsup не вмикає dts (декларації — лише tsc)', async () => {
    // Імпорт, не регекс: конфіг — код, і форма запису може мінятись.
    const mod = (await import(
      resolve(root, 'packages/simplycms/tsup.config.ts')
    )) as { default: Array<{ name?: string; dts?: unknown }> };
    const offenders = mod.default
      .filter((profile) => Boolean(profile.dts))
      .map((profile) => profile.name ?? '(без назви)');
    expect(
      offenders,
      'профілі з dts: true — це шлях назад до 36 ts.Program і OOM',
    ).toEqual([]);
  });

  it('build:packages веде через кеп-скрипт із очікуваними константами', async () => {
    const rootPkg = JSON.parse(read('package.json')) as {
      scripts: Record<string, string>;
    };
    expect(rootPkg.scripts['build:packages']).toBe(
      'node scripts/build-packages.mjs',
    );
    const guard = await import(resolve(root, 'scripts/build-packages.mjs'));
    // Кеп — контракт, не деталь: його значення цитують доки й це
    // повідомлення помилки. Зміна — свідоме рішення, не рефакторинг.
    expect(guard.HEAP_CAP_MB).toBe(3072);
    expect(guard.WALL_CAP_SECONDS).toBe(300);
  });

  it('tsconfig.dts.json: emitDeclarationOnly і виключені __tests__', () => {
    const raw = read('packages/simplycms/tsconfig.dts.json');
    // tsconfig — JSONC (коментарі), тож звіряємо по рядках, не парсером.
    expect(raw).toContain('"emitDeclarationOnly": true');
    expect(raw).toContain('"declaration": true');
    // Без цього d.ts тестів поїхали б у tarball.
    expect(raw).toContain('src/**/__tests__/**');
  });

  it('build пакета ядра викликає tsc-емісію декларацій', () => {
    const pkg = JSON.parse(read('packages/simplycms/package.json')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.build).toContain('tsc -p tsconfig.dts.json');
  });
});
