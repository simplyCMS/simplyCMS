// Фінальне рев'ю М1, раунд 2 (N4): повнота мови рахує розбіжності агрегатом у SQL, а приклади
// бере `LIMIT` — лічильник не обмежений вибіркою прикладів.
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { languagesAdd, languagesFill } from 'simplycms/admin-server/impl';
import {
  INCOMPLETE_SAMPLE,
  completeness,
} from '../../../src/admin-server/impl/languages/completeness';
import { useAddressingDb } from './fixtures/addressing-db';
import { exec } from './fixtures/product-aggregate';

describe('повнота мови: лічильники й приклади (N4)', () => {
  const db = useAddressingDb('simplycms_language_completeness');

  it('товарів без адреси більше за межу прикладів: лік повний, прикладів — межа', async () => {
    const n = INCOMPLETE_SAMPLE + 2;
    for (let i = 0; i < n; i += 1) await db.product(`cmp-${i}`);
    await exec(languagesAdd, { id: randomUUID(), code: 'lv', name: 'lv' });
    const c = await db.admin((d) => completeness(d, 'lv'));
    expect(c.complete).toBe(false);
    expect(c.missingPaths).toBe(n);
    expect(c.incomplete.filter((i) => i.stage === 'path')).toHaveLength(
      INCOMPLETE_SAMPLE,
    );
  });

  it('проєкції бракує більше за межу прикладів: лік агрегатом повний, прикладів — межа (R2-6)', async () => {
    await exec(languagesAdd, { id: randomUUID(), code: 'et', name: 'et' });
    // Один виклик fill — режим адрес: адреси є, проєкції ще немає.
    await exec(languagesFill, { code: 'et' });
    const c = await db.admin((d) => completeness(d, 'et'));
    expect(c.missingPaths).toBe(0);
    expect(c.missingProjection).toBe(INCOMPLETE_SAMPLE + 2);
    expect(c.incomplete.filter((i) => i.stage === 'projection')).toHaveLength(
      INCOMPLETE_SAMPLE,
    );
  });
});
