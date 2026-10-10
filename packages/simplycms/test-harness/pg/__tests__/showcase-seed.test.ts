// Гейт С-8 (а, в, г, д, е) і Review Focus 3: сід вітрини на чистій демо-базі.
//
// 🔴 Сід кличеться як модуль (`scripts/showcase/run.mts` реекспортує
// `seedShowcase`, імпорт команду не стартує) на унікальній базі з власною
// медіатекою — `fixtures/showcase-seed.ts`. Мок `requireGrant` потрібен лише
// операції дашборду (г); що сам сід authz не обходить, доводить асерт
// «`requireGrant` не викликався під час сіду».
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { requireGrant } from 'simplycms/auth';
import { dashboardSummaryOp } from 'simplycms/admin-server/impl';
import { MEDIA_URL_BASE } from 'simplycms/domain/media';
import { localFsDriver, serveMedia, sniffImageMime } from 'simplycms/storage';
import { ShowcaseNotPristineError } from '../../../../../scripts/showcase/guard.mts';
import { seedShowcase } from '../../../../../scripts/showcase/run.mts';
import { resolveHarness } from '../up.mjs';
import { findOrphans } from './fixtures/orphans';
import * as Q from './fixtures/showcase-queries';
import {
  mediaFiles,
  seedFreshShowcase,
  tableCounts,
  type SeededShowcase,
} from './fixtures/showcase-seed';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: {
      userId: 'a0000000-0000-4000-8000-0000000005c8',
      roles: ['admin'],
    },
    scope: 'any',
  })),
}));

describe('сід вітрини: гейт С-8', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  let s: SeededShowcase;
  const one = async <T>(sql: string, p: unknown[] = []) =>
    (await s.rows<T>(sql, p))[0]!;

  beforeAll(async () => {
    harness = await resolveHarness();
    s = await seedFreshShowcase(harness.url, 'showcase_seed');
  }, 300_000);

  afterAll(async () => {
    await s?.cleanup();
    await harness?.teardown();
  }, 120_000);

  it('(а) накат на чисту базу (канон + демо) дає обсяг С-4', async () => {
    const v = await one<Q.Volume>(Q.VOLUME);
    expect(v.sections).toBeGreaterThanOrEqual(s.demo.sections + 3);
    expect(v.products).toBeGreaterThanOrEqual(s.demo.products + 24);
    expect(v.productsWithoutImages).toBe(0);
    expect(v.priceTypes).toBeGreaterThanOrEqual(2);
    expect(v.pickupPoints).toBeGreaterThanOrEqual(2);
    expect(v.productsWithoutStock).toBe(0);
    expect(v.buyers).toBe(17); // 18 зареєстрованих − 1 видалений (Е6г)
    expect(v.guestOrders).toBeGreaterThan(0);
    expect(v.courierOrders).toBeGreaterThan(0);
    expect(v.pickupOrders).toBeGreaterThan(0);
    expect(v.approvedReviews).toBe(v.reviews);
    expect(v.reviews).toBeGreaterThanOrEqual(10);
    expect(v.foreignEmails).toBe(0);
    const statuses = await s.rows<{ code: string }>(Q.BY_STATUS);
    expect(statuses.map((r) => r.code).sort()).toEqual(Q.ALL_STATUSES);
  });

  it('Review Focus 3: файл кожного зображення лежить за ref у MEDIA_ROOT, це PNG, роздача — 200', async () => {
    const refs = (await s.rows<{ ref: string }>(Q.PRODUCT_IMAGE_REFS)).map(
      (r) => r.ref,
    );
    expect(refs.length).toBeGreaterThan(30);
    const files = new Set(await mediaFiles(s.env.mediaRoot));
    for (const ref of refs) {
      expect(files.has(ref), ref).toBe(true);
      const bytes = await readFile(join(s.env.mediaRoot, ref));
      expect(sniffImageMime(new Uint8Array(bytes)), ref).toBe('image/png');
    }
    const url = `http://localhost${MEDIA_URL_BASE.replace(/\/+$/, '')}/${refs[0]}`;
    const res = await serveMedia(
      { request: new Request(url) },
      localFsDriver(s.env.mediaRoot),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
  });

  it('(в) повторний seedShowcase на засіяній базі → ShowcaseNotPristineError, нічого не записано', async () => {
    const before = await tableCounts(s);
    const filesBefore = await mediaFiles(s.env.mediaRoot);
    await expect(seedShowcase(s.env)).rejects.toBeInstanceOf(
      ShowcaseNotPristineError,
    );
    expect(await tableCounts(s)).toEqual(before);
    expect(await mediaFiles(s.env.mediaRoot)).toEqual(filesBefore);
  });

  it('(г) dashboardSummaryOp = прямий SQL; скасовані поза виручкою; дати розкидані', async () => {
    // Сід ішов ядрами, а не операціями: authz він не обходив моком.
    expect(vi.mocked(requireGrant)).not.toHaveBeenCalled();
    const summary = await dashboardSummaryOp();
    const sql = await one<Q.Revenue>(Q.REVENUE);
    expect(summary.newOrders).toBe(sql.newOrders);
    expect(summary.revenue7dCents).toBe(sql.r7);
    expect(summary.revenue30dCents).toBe(sql.r30);
    // Скасовані справді є у вікні — інакше «поза виручкою» нічого не доводить.
    expect(sql.cancelled30).toBeGreaterThan(0);
    // Дашборд справді виключив їх: інакше його виручка = усім замовленням вікна.
    expect(summary.revenue30dCents).toBe(
      sql.r30WithCancelled - sql.cancelled30,
    );
    expect(summary.revenue30dCents).not.toBe(sql.r30WithCancelled);
    // 🔴 Незалежні від SQL асерти дат (аудит Codex): без зсуву часу
    // порівняння вище зелене, а ці — ні.
    expect(sql.olderThan7d).toBeGreaterThan(0);
    expect(summary.revenue30dCents).toBeGreaterThan(summary.revenue7dCents);
    expect(sql.maxDay).toBeLessThan(30);
  });

  it('(е) автоправило перевело ≥1 покупця у VIP; закріплений лишився в «Партнерах»', async () => {
    const vip = await s.rows<{ email: string }>(Q.VIP_BY_RULE);
    expect(vip.length).toBeGreaterThanOrEqual(1);
    const locked = await one<Q.Category>(Q.CATEGORY_OF, [
      'buyer-03@showcase.test',
    ]);
    expect(locked).toMatchObject({ code: 'partner', locked: true, byRule: 0 });
    expect(locked.orders).toBeGreaterThanOrEqual(3);
  });

  it('(д) видалений покупець: ПД замовлень NULL, відгук анонімний, сиріт немає', async () => {
    const d = await one<Q.Deleted>(Q.DELETED, ['buyer-18@showcase.test']);
    expect(d.users).toBe(0);
    expect(d.anonReviews).toBeGreaterThanOrEqual(1);
    // Без стертої АДРЕСНОЇ доставки асерт ship_* нічого б не доводив.
    expect(d.addressErased).toBeGreaterThan(0);
    const erased = await s.rows<Record<string, unknown>>(Q.erasedOrders());
    expect(erased.length).toBeGreaterThan(0);
    for (const row of erased) {
      for (const [col, value] of Object.entries(row))
        expect(value, col).toBeNull();
    }
    expect(await findOrphans((sql) => s.rows(sql))).toEqual({});
  });
});
