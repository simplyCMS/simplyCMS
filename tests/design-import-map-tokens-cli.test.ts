/**
 * Тест CLI-обгортки `map-tokens.mjs` (Фаза 3, задача §2.B, план — Фаза 3
 * Step 2): реальний процес через `spawnSync(process.execPath, …)` за зразком
 * `tests/cli-add.test.ts:204` (НЕ `execFile` — план вимагає саме spawnSync).
 * tmp-dir — щоб не смітити в репозиторії.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sampleInspection } from './fixtures/design-import/inspection.fixture.mjs';

const cli = fileURLToPath(
  new URL(
    '../.agents/skills/redesign-from-reference/scripts/map-tokens.mjs',
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

    const outPath = join(dir, 'tokens-proposal.json');
    const proposal = JSON.parse(readFileSync(outPath, 'utf8'));
    expect(proposal.schemaVersion).toBe(1);
    expect(proposal.tokens.background).toBeDefined();
    expect(proposal.unmapped).toEqual(['#fbbf24']);
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
});
