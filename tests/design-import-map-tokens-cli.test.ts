/**
 * Тест CLI-обгортки `map-tokens.mjs` (Фаза 3, задача §2.B, план — Фаза 3
 * Step 2): реальний процес через `spawnSync(process.execPath, …)` за зразком
 * `tests/cli-add.test.ts:204` (НЕ `execFile` — план вимагає саме spawnSync).
 * tmp-dir — щоб не смітити в репозиторії.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  assertSupportedVersion,
  SUPPORTED_INSPECTION_VERSIONS,
} from '../.agents/skills/redesign-from-reference/scripts/lib/inspection-version.mjs';
import { sampleInspection } from './fixtures/design-import/inspection.fixture.mjs';

const cli = fileURLToPath(
  new URL(
    '../.claude/skills/redesign-from-reference/scripts/map-tokens.mjs',
    import.meta.url,
  ),
);

describe('map-tokens.mjs — CLI-обгортка', () => {
  it('читає inspection.json, пише tokens-proposal.json, друкує підсумок українською', () => {
    const dir = mkdtempSync(join(tmpdir(), 'map-tokens-'));
    const inspectionPath = join(dir, 'inspection.json');
    writeFileSync(inspectionPath, JSON.stringify(sampleInspection), 'utf8');

    const run = spawnSync(process.execPath, [cli, inspectionPath], {
      encoding: 'utf8',
    });

    expect(run.status).toBe(0);
    expect(run.stdout).toContain('Топ-мапінги');
    expect(run.stdout).toContain('Немапованих кольорів');
    // Р7: у stdout — рівно те, що людині корисно очима (hex + частота), а не
    // серіалізований запис цілком.
    expect(run.stdout).toContain('#fbbf24 (×5)');
    expect(run.stdout).not.toContain('contrastOnBackground');

    const outPath = join(dir, 'tokens-proposal.json');
    const proposal = JSON.parse(readFileSync(outPath, 'utf8'));
    expect(proposal.schemaVersion).toBe(2);
    expect(proposal.tokens.background).toBeDefined();
    expect(proposal.unmapped).toMatchObject([
      { hex: '#fbbf24', role: 'background', count: 5, belowAA: false },
    ]);
  });

  it('--out пише пропозицію за явним шляхом', () => {
    const dir = mkdtempSync(join(tmpdir(), 'map-tokens-out-'));
    const inspectionPath = join(dir, 'inspection.json');
    const outPath = join(dir, 'custom-proposal.json');
    writeFileSync(inspectionPath, JSON.stringify(sampleInspection), 'utf8');

    const run = spawnSync(
      process.execPath,
      [cli, inspectionPath, '--out', outPath],
      { encoding: 'utf8' },
    );

    expect(run.status).toBe(0);
    expect(run.stdout).toContain(outPath);
    const proposal = JSON.parse(readFileSync(outPath, 'utf8'));
    expect(proposal.tokens.background).toBeDefined();
  });

  // Р2: капчер підняв версію `inspection.json` до 2 (секція `motion`), Б.3 —
  // до 3 (форма `motion` змінилась), але токени НЕ розширювались: мапінг
  // споживає всі три версії однаково, а motion ігнорує. Кейси нижче — про
  // гейт версії, не про мапінг.
  it.each([2, 3])(
    'schemaVersion %i (з motion) читається так само, як 1',
    (schemaVersion) => {
      const dir = mkdtempSync(join(tmpdir(), `map-tokens-v${schemaVersion}-`));
      const inspectionPath = join(dir, 'inspection.json');
      writeFileSync(
        inspectionPath,
        JSON.stringify({
          ...sampleInspection,
          schemaVersion,
          motion: {
            transitions: [
              {
                property: 'opacity',
                durationMs: 600,
                easing: 'ease',
                count: 2,
              },
            ],
            keyframes: { names: ['fade-in'], inaccessibleSheets: 0 },
            reveal: [],
            revealSampled: 0,
            revealRoot: 'body-fallback',
            jsLibraries: { detected: [], markers: [] },
            // Нульова вибірка — саме `'unknown'` (V-5): фікстура має лишатись
            // формою реального виводу капчера, а не історичною.
            jsDrivenSuspected: 'unknown',
          },
        }),
        'utf8',
      );

      const run = spawnSync(process.execPath, [cli, inspectionPath], {
        encoding: 'utf8',
      });

      expect(run.status).toBe(0);
      const proposal = JSON.parse(
        readFileSync(join(dir, 'tokens-proposal.json'), 'utf8'),
      );
      // Версія ПРОПОЗИЦІЇ — окремий лічильник, motion у токени не мапиться.
      expect(proposal.schemaVersion).toBe(2);
      expect(proposal).not.toHaveProperty('motion');
      expect(proposal.tokens.background).toBeDefined();
    },
  );

  it('незнайома schemaVersion — гучний exit 1 з поясненням', () => {
    const dir = mkdtempSync(join(tmpdir(), 'map-tokens-v99-'));
    const inspectionPath = join(dir, 'inspection.json');
    writeFileSync(
      inspectionPath,
      JSON.stringify({ ...sampleInspection, schemaVersion: 99 }),
      'utf8',
    );

    const run = spawnSync(process.execPath, [cli, inspectionPath], {
      encoding: 'utf8',
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('schemaVersion=99');
    expect(run.stderr).toContain('1, 2 або 3');
  });

  it('відсутній файл — гучний exit 1, повідомлення в stderr', () => {
    const run = spawnSync(process.execPath, [cli, '/no/such/inspection.json'], {
      encoding: 'utf8',
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('Не вдалося прочитати');
  });

  it('без аргументів — гучний exit 1 з юзажем', () => {
    const run = spawnSync(process.execPath, [cli], { encoding: 'utf8' });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('Потрібен шлях');
  });

  // Р6b: мультивхід — N=1 вище лишається байт-у-байт (те саме `sampleInspection`,
  // ті самі очікування); тут — лише поведінка при N>1.
  it('N>1 без --out — гучний exit 1: вивід не можна вгадати з однієї з тек', () => {
    const dir = mkdtempSync(join(tmpdir(), 'map-tokens-multi-'));
    const pathA = join(dir, 'a', 'inspection.json');
    const pathB = join(dir, 'b', 'inspection.json');
    mkdirSync(join(dir, 'a'), { recursive: true });
    mkdirSync(join(dir, 'b'), { recursive: true });
    writeFileSync(pathA, JSON.stringify(sampleInspection), 'utf8');
    writeFileSync(pathB, JSON.stringify(sampleInspection), 'utf8');

    const run = spawnSync(process.execPath, [cli, pathA, pathB], {
      encoding: 'utf8',
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('обовʼязковий');
  });

  it('N>1 з --out — зливає й пише sources: [{file, url}]', () => {
    const dir = mkdtempSync(join(tmpdir(), 'map-tokens-multi-out-'));
    const pathA = join(dir, 'a', 'inspection.json');
    const pathB = join(dir, 'b', 'inspection.json');
    mkdirSync(join(dir, 'a'), { recursive: true });
    mkdirSync(join(dir, 'b'), { recursive: true });
    const inspectionB = {
      ...sampleInspection,
      url: 'https://reference.example/product',
    };
    writeFileSync(pathA, JSON.stringify(sampleInspection), 'utf8');
    writeFileSync(pathB, JSON.stringify(inspectionB), 'utf8');
    const outPath = join(dir, 'tokens-proposal.json');

    const run = spawnSync(
      process.execPath,
      [cli, pathA, pathB, '--out', outPath],
      { encoding: 'utf8' },
    );

    expect(run.status).toBe(0);
    expect(run.stdout).toContain('Джерел злито: 2');
    const proposal = JSON.parse(readFileSync(outPath, 'utf8'));
    expect(proposal.sources).toEqual([
      { file: pathA, url: 'https://reference.example/' },
      { file: pathB, url: 'https://reference.example/product' },
    ]);
    expect(proposal.tokens.background).toBeDefined();
  });
});

// Гейт версії — юніт БЕЗ `spawnSync`: процес доводить лише exit-код, а тут
// перевіряється сама форма відмови (текст помилки читає людина в терміналі).
describe('lib/inspection-version.mjs — assertSupportedVersion', () => {
  it('підтримувані версії проходять мовчки', () => {
    expect(SUPPORTED_INSPECTION_VERSIONS).toEqual([1, 2, 3]);
    for (const schemaVersion of SUPPORTED_INSPECTION_VERSIONS) {
      expect(() =>
        assertSupportedVersion('a/inspection.json', { schemaVersion }),
      ).not.toThrow();
    }
  });

  it('незнайома версія — гучна помилка зі шляхом, версією і підказкою', () => {
    expect(() =>
      assertSupportedVersion('a/inspection.json', { schemaVersion: 4 }),
    ).toThrow(/a\/inspection\.json: schemaVersion=4/);
    expect(() =>
      assertSupportedVersion('a/inspection.json', { schemaVersion: 4 }),
    ).toThrow(/1, 2 або 3/);
  });

  // Поле може бути відсутнім (інспекція до Р2) або файл — узагалі не тим:
  // мовчки змапити чужу форму гірше, ніж упасти.
  it('відсутнє поле, undefined і не-число — теж помилка', () => {
    expect(() => assertSupportedVersion('x.json', {})).toThrow(
      /schemaVersion=undefined/,
    );
    expect(() => assertSupportedVersion('x.json')).toThrow(/непідтримувана/);
    expect(() =>
      assertSupportedVersion('x.json', { schemaVersion: '2' }),
    ).toThrow(/schemaVersion=2/);
  });
});
