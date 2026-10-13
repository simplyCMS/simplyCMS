import { describe, expect, it } from 'vitest';
import { retagCreateReadme } from '../scripts/release/readme-tag.mjs';

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
});
