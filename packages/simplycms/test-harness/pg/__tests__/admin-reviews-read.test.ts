// К3-Е6д, Task 6: читання модерації відгуків — keyset-список, лічильник, картка.
import { describe, expect, it, vi } from 'vitest';
import {
  countPendingReviewsOp,
  getReviewCardOp,
  listReviewsOp,
} from 'simplycms/admin-server/impl';
import type { AdminReviewCursor } from 'simplycms/contracts';
import { useReviewsDb } from './fixtures/reviews';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

describe('admin: читання модерації відгуків (Е6д-7, Е6д-11)', () => {
  const d = useReviewsDb('simplycms_e6d_rv_read');
  const { f } = d;

  it('keyset: 5 відгуків, два з однаковим created_at → без дублів і пропусків', async () => {
    const t = (n: number) => `2026-01-0${n}T10:00:00.000Z`;
    const ids = [
      await d.seedReview({ createdAt: t(1) }),
      await d.seedReview({ createdAt: t(2) }),
      await d.seedReview({ createdAt: t(3) }),
      await d.seedReview({ createdAt: t(3) }),
      await d.seedReview({ createdAt: t(4) }),
    ];
    const seen: string[] = [];
    let cursor: AdminReviewCursor | undefined;
    let pages = 0;
    do {
      const page = await listReviewsOp({ data: { cursor }, pageSize: 2 });
      seen.push(...page.rows.map((r) => r.id).filter((id) => ids.includes(id)));
      cursor = page.nextCursor ?? undefined;
      pages++;
    } while (cursor && pages < 20);
    expect(seen.length).toBe(5);
    expect(new Set(seen).size).toBe(5);
    expect(pages).toBeGreaterThanOrEqual(3);
  });

  it('фільтр status: pending; лічильник не залежить від фільтра', async () => {
    const before = await countPendingReviewsOp();
    const p = await d.seedReview({ status: 'pending' });
    await d.seedReview({ status: 'approved' });
    const page = await listReviewsOp({ data: { status: 'approved' } });
    expect(page.rows.every((r) => r.status === 'approved')).toBe(true);
    const pending = await listReviewsOp({ data: { status: 'pending' } });
    expect(pending.rows.map((r) => r.id)).toContain(p);
    expect(await countPendingReviewsOp()).toEqual({
      pending: before.pending + 1,
    });
  });

  it('без автора → null/null; без profiles → users.name; з profiles → імʼя профілю', async () => {
    const anon = await d.seedReview({ userId: null });
    const named = await d.seedReview({ userId: await d.seedUser('Нік') });
    const prof = await d.seedReview({
      userId: await d.seedUser('Нік2', ['Олена', 'Коваль']),
    });
    const { rows } = await listReviewsOp({ data: {} });
    const by = (id: string) => rows.find((r) => r.id === id)!;
    expect(by(anon)).toMatchObject({ authorName: null, authorEmail: null });
    expect(by(named).authorName).toBe('Нік');
    expect(by(prof).authorName).toBe('Олена Коваль');
    const card = await getReviewCardOp({ data: { id: anon } });
    expect(card).toMatchObject({ authorName: null, authorEmail: null });
  });

  it('images = NULL і {} → список і картка не падають (р4 M5)', async () => {
    const nul = await d.seedReview({ images: null });
    const obj = await d.seedReview({ images: {} });
    const { rows } = await listReviewsOp({ data: {} });
    expect(rows.find((r) => r.id === nul)?.imagesCount).toBe(0);
    expect(rows.find((r) => r.id === obj)?.imagesCount).toBe(0);
    expect((await getReviewCardOp({ data: { id: nul } }))?.images).toEqual([]);
    expect((await getReviewCardOp({ data: { id: obj } }))?.images).toEqual([]);
  });

  it('картка: очищений content, images — референси, sectionSlug; невідомий id → null', async () => {
    const id = await d.seedReview({
      content: '<p>текст</p><script>alert(1)</script>',
      adminComment: 'нотатка',
    });
    const refs = await d.seedPhotos(id, 2);
    const card = await getReviewCardOp({ data: { id } });
    expect(card?.content).toContain('<p>текст</p>');
    expect(card?.content).not.toMatch(/<script/i);
    expect(card?.images).toEqual(refs);
    expect(card?.imagesCount).toBe(2);
    expect(card?.adminComment).toBe('нотатка');
    const expected = await f.one<{ slug: string | null }>(
      `select s.slug from public.products p left join public.sections s on s.id = p.section_id where p.id = $1`,
      [f.ids.panel],
    );
    expect(card?.sectionSlug).toBe(expected.slug);
    expect(card?.productSlug).toBeTruthy();
    expect(
      await getReviewCardOp({ data: { id: crypto.randomUUID() } }),
    ).toBeNull();
  });
});
