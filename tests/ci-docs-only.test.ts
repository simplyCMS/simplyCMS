import { describe, expect, it } from 'vitest';
import { changesCode } from '../scripts/ci/docs-only.mjs';

// Класифікатор вирішує, чи CI пропустить build, typecheck, пакування й PG-харнес: хибне
// «лише документи» тихо зняло б гейти з коду, тому межа перевірена з обох боків.
describe('CI: PR лише з документами', () => {
  it('docs/ і кореневі *.md — документи', () => {
    expect(
      changesCode([
        'docs/adr/0001-x.md',
        'AGENTS.md',
        '.agents/review-criteria.md',
      ]),
    ).toBe(false);
  });

  it('*.md у пакеті — код: він їде в tarball', () => {
    expect(
      changesCode([
        'docs/a.md',
        'packages/simplycms/skills/simplycms-update/SKILL.md',
      ]),
    ).toBe(true);
  });

  it('будь-який файл поза документами робить PR кодовим', () => {
    expect(changesCode(['docs/a.md', '.github/workflows/workflow.yml'])).toBe(
      true,
    );
    expect(
      changesCode(['docs/marketplace/index.sample.json', 'README.md']),
    ).toBe(false);
  });

  it('порожній список — код: невизначеність не пропускає перевірки', () => {
    expect(changesCode([])).toBe(true);
    expect(changesCode(['', '  '])).toBe(true);
  });
});
