// Гейт хронології сіду вітрини (С-3, SHOWCASE-2): зсув часу узгоджений —
// реєстрація раніша за замовлення й історію категорій, номер замовлення
// датований днем замовлення, а не днем прогону.
//
// 🔴 Без зсуву реєстрації (або номера) картка покупця й списки адмінки
// показують замовлення, старші за самого покупця, — це й ловить гейт.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveHarness } from '../up.mjs';
import { CHRONOLOGY, type Chronology } from './fixtures/showcase-chronology';
import {
  seedFreshShowcase,
  type SeededShowcase,
} from './fixtures/showcase-seed';

describe('сід вітрини: хронологія після зсуву часу', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  let s: SeededShowcase;

  beforeAll(async () => {
    harness = await resolveHarness();
    s = await seedFreshShowcase(harness.url, 'showcase_chrono');
  }, 300_000);

  afterAll(async () => {
    await s?.cleanup();
    await harness?.teardown();
  }, 120_000);

  it('жодна подія покупця не раніша за реєстрацію; номер — дата замовлення', async () => {
    const [c] = await s.rows<Chronology>(CHRONOLOGY);
    expect(c).toMatchObject({
      ordersBeforeRegistration: 0,
      historyBeforeRegistration: 0,
      bannedBeforeRegistration: 0,
      updatedBeforeCreated: 0,
      profileRegistrationMismatch: 0,
      malformedNumbers: 0,
      numberDateMismatch: 0,
    });
    // Реєстрація справді зсунута за межі вікна замовлень, а не лишилась «сьогодні».
    expect(c!.maxOrderDay).toBeGreaterThan(0);
    expect(c!.minRegistrationDay).toBeGreaterThan(c!.maxOrderDay);
  });
});
