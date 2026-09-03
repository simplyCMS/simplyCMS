import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Структурний гард тулчейна декларацій (розтин OOM 2026-08-24).
//
// 🔴 Що саме стережемо. dts-механізм бандлера (rollup-plugin-dts у tsup,
// rolldown-plugin-dts у tsdown — обидва тримають повну ts.Program; виміряно
// 2026-08-24 і 2026-09-02) вичерпує памʼять саме на цьому пакеті: у tsup він
// створював окрему повну ts.Program на КОЖНУ теку entry профілю і тримав їх
// усі живими (228 entry у 34 теках → 36 програм і 9 ГБ heap), у tsdown одна
// програма зʼїдає 3 ГБ за 25 с. Тому декларації пакета ядра НАЗАВЖДИ емітить
// `tsc -p tsconfig.dts.json` (11 с і 1,1 ГБ), а збірка йде під кепом памʼяті
// (scripts/build-packages.mjs). Поведінковий бік (реальний прогін під кепом)
// перевіряє сам крок build:packages у кожному контурі; тут — дешеві
// структурні асерти, що ламаються ПЕРШИМИ, коли хтось «повертає як було».

const root = resolve(import.meta.dirname, '..');
const read = (rel: string): string => readFileSync(resolve(root, rel), 'utf8');

describe('тулчейн декларацій: dts поза бандлером', () => {
  it('жодна збірка tsdown ядра не вмикає dts (декларації — лише tsc)', async () => {
    // Імпорт, не регекс: конфіг — код, і форма запису може мінятись.
    const mod = (await import(
      resolve(root, 'packages/simplycms/tsdown.config.ts')
    )) as { default: Array<{ dts?: unknown; entry: Record<string, string> }> };
    // Рівно дві збірки — клієнтська й серверна (трек T): третя означала б,
    // що межу знову тримає розкладка профілів, а не декларація.
    expect(mod.default).toHaveLength(2);
    const offenders = mod.default
      .filter((config) => Boolean(config.dts))
      .map((config) => Object.keys(config.entry).slice(0, 3).join(','));
    expect(
      offenders,
      'збірки з dts: true — це шлях назад до OOM (dts-плагін бандлера тримає повну ts.Program)',
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
    expect(pkg.scripts.build).toBe('tsdown && tsc -p tsconfig.dts.json');
  });
});
