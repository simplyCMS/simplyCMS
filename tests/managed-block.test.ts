import { mkdirSync, mkdtempSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BLOCK_BEGIN,
  BLOCK_END,
  applyManagedBlock,
  renderManagedBlock,
} from '../packages/cli/src/managed-block.mjs';
import { inspectAgentFiles } from '../packages/cli/src/agent-files.mjs';
import { scaffold } from '../packages/create-simplycms-store/src/scaffold.mjs';

// Керований блок AGENTS.md (Б §3.3, Е8-Р5): одна функція для синку шаблону й update.
const INTRO = readFileSync('packages/simplycms/agent/intro.md', 'utf8');
const BLOCK = renderManagedBlock(INTRO);
const OWNER_HEAD = '# Мій магазин\n\nМої правила до блоку.\n\n';
const OWNER_TAIL = '\n\n## Ще моє\n\nПісля блоку — теж моє.\n';

describe('managed-block', () => {
  it('блок = BEGIN + вступ + правило status + END', () => {
    expect(BLOCK.startsWith(`${BLOCK_BEGIN}\n`)).toBe(true);
    expect(BLOCK.endsWith(`\n${BLOCK_END}`)).toBe(true);
    expect(BLOCK).toContain(INTRO.trim());
    expect(BLOCK).toContain('pnpm simplycms status');
  });

  it('файл без маркерів чи без файлу → missing, без next', () => {
    expect(applyManagedBlock('# лише текст власника\n', BLOCK)).toEqual({
      status: 'missing',
    });
    expect(applyManagedBlock(null, BLOCK)).toEqual({ status: 'missing' });
  });

  it('порожня пара маркерів → блок вставлено між ними, текст власника байт-у-байт', () => {
    const file = `${OWNER_HEAD}${BLOCK_BEGIN}\n${BLOCK_END}${OWNER_TAIL}`;
    const { status, next } = applyManagedBlock(file, BLOCK);
    expect(status).toBe('drift');
    expect(next).toBe(`${OWNER_HEAD}${BLOCK}${OWNER_TAIL}`);
  });

  it('повторне застосування → ok, байт-у-байт той самий текст', () => {
    const file = `${OWNER_HEAD}${BLOCK}${OWNER_TAIL}`;
    expect(applyManagedBlock(file, BLOCK)).toEqual({
      status: 'ok',
      next: file,
    });
  });

  it('оновлення застарілого блоку не чіпає текст власника до й після маркерів', () => {
    const stale = `${OWNER_HEAD}<!-- simplycms:begin (стара версія) -->\nстарий вступ\n${BLOCK_END}${OWNER_TAIL}`;
    const { status, next } = applyManagedBlock(stale, BLOCK);
    expect(status).toBe('drift');
    expect(next?.startsWith(OWNER_HEAD)).toBe(true);
    expect(next?.endsWith(OWNER_TAIL)).toBe(true);
    expect(next).toBe(`${OWNER_HEAD}${BLOCK}${OWNER_TAIL}`);
  });

  it.each([
    ['лише BEGIN', `${OWNER_HEAD}${BLOCK_BEGIN}\n`],
    ['лише END', `${OWNER_HEAD}${BLOCK_END}\n`],
    ['два BEGIN', `${BLOCK_BEGIN}\n${BLOCK_BEGIN}\n${BLOCK_END}\n`],
    ['END перед BEGIN', `${BLOCK_END}\n${BLOCK_BEGIN}\n`],
  ])('damaged (%s) → без next', (_name, file) => {
    expect(applyManagedBlock(file, BLOCK)).toEqual({ status: 'damaged' });
  });

  it('паритет: блок у template/AGENTS.md === renderManagedBlock(intro.md)', () => {
    const template = readFileSync(
      'packages/create-simplycms-store/template/AGENTS.md',
      'utf8',
    );
    expect(applyManagedBlock(template, BLOCK).status).toBe('ok');
    expect(template).toContain(BLOCK);
  });

  it('паритет: update для свіжого магазину рендерить той самий блок', async () => {
    const store = join(mkdtempSync(join(tmpdir(), 'managed-block-')), 'shop');
    await scaffold({
      templateDir: 'packages/create-simplycms-store/template',
      targetDir: store,
      storeName: 'shop',
      version: '9.9.9-sentinel',
    });
    // Встановлене ядро магазину — сирці пакета: те саме джерело вступу, що в tarball.
    mkdirSync(join(store, 'node_modules', 'simplycms'), { recursive: true });
    symlinkSync(
      resolve('packages/simplycms/agent'),
      join(store, 'node_modules', 'simplycms', 'agent'),
    );
    expect(inspectAgentFiles(store).block).toEqual({
      status: 'ok',
      next: readFileSync(join(store, 'AGENTS.md'), 'utf8'),
    });
  });
});
