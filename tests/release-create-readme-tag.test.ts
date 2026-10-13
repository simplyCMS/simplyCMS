import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  bumpCreateReadmeTag,
  retagCreateReadme,
} from '../scripts/release/readme-tag.mjs';

// Тег у README пакета на npm мусить іти за версією, що виходить: пререліз
// ставиться лише під `@next`, а `pnpm create` без тега взяв би `latest`.
const BODY = [
  '```bash',
  'pnpm create simplycms-store@next my-shop',
  '```',
  'Також: `pnpm create simplycms-store --yes`.',
].join('\n');

describe('retagCreateReadme', () => {
  it('пререліз ставить @next в усі команди створення', () => {
    const out = retagCreateReadme(BODY, '1.0.0-rc.2');
    expect(out.match(/pnpm create simplycms-store@next/g)).toHaveLength(2);
  });

  it('стабільна версія прибирає тег, а не пише @latest', () => {
    const out = retagCreateReadme(BODY, '1.0.0');
    expect(out).not.toContain('@next');
    expect(out).not.toContain('@latest');
    expect(out.match(/pnpm create simplycms-store(?=[ \n`.])/g)).toHaveLength(
      2,
    );
  });

  it('інші частини тексту не чіпає', () => {
    expect(retagCreateReadme('нічого', '1.0.0')).toBe('нічого');
  });

  it('ловить команду в самому кінці файлу', () => {
    expect(retagCreateReadme('pnpm create simplycms-store', '1.0.0-rc.1')).toBe(
      'pnpm create simplycms-store@next',
    );
  });

  it('не чіпає схожі імена пакетів', () => {
    const text = 'pnpm create simplycms-store-extra';
    expect(retagCreateReadme(text, '1.0.0-rc.1')).toBe(text);
  });
});

describe('bumpCreateReadmeTag', () => {
  it('переписує файл і повторний виклик ідемпотентний', () => {
    const dir = mkdtempSync(join(tmpdir(), 'readme-tag-'));
    const path = join(dir, 'README.md');
    try {
      writeFileSync(path, BODY);
      bumpCreateReadmeTag('1.0.0-rc.1', path);
      const once = readFileSync(path, 'utf8');
      expect(once.match(/simplycms-store@next/g)).toHaveLength(2);
      bumpCreateReadmeTag('1.0.0-rc.1', path);
      expect(readFileSync(path, 'utf8')).toBe(once);
      bumpCreateReadmeTag('1.0.0', path);
      expect(readFileSync(path, 'utf8')).not.toContain('@next');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
