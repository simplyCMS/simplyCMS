// К3-Е6д, Task 3: перехресні правила банера на злитому рядку `before ⊕ patch`
// (Е6д-2) і «замурований» банер після видалення розділу (Е6д-12, Review Focus 4).
import { describe, expect, it, vi } from 'vitest';
import { bannersOps } from 'simplycms/admin-server/impl';
import { withStorefrontDb, loadBanners } from 'simplycms/storefront/loaders';
import { useBannersDb } from './fixtures/admin-banners';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

describe('admin: guard банерів (Е6д-2, Е6д-12)', () => {
  const t = useBannersDb('simplycms_e6d_banners_guard');

  it('insert: section без sectionId і sectionId при home → 400 [sectionId]', async () => {
    await t.expectIssue(
      () => t.insert({ placement: 'section' }),
      ['sectionId'],
      'invalid_value',
    );
    const sectionId = await t.seedSection();
    await t.expectIssue(
      () => t.insert({ placement: 'home', sectionId }),
      ['sectionId'],
      'invalid_value',
    );
    await t.expectIssue(
      () => t.insert({ sectionId }),
      ['sectionId'],
      'invalid_value',
    );
  });

  it('dateFrom > dateTo → [dateTo] too_small', async () => {
    const bad = {
      dateFrom: new Date('2026-02-01'),
      dateTo: new Date('2026-01-01'),
    };
    await t.expectIssue(() => t.insert(bad), ['dateTo'], 'too_small');
    const id = await t.insert({ dateFrom: new Date('2026-01-01') });
    await t.expectIssue(
      () => t.update(id, { dateTo: new Date('2025-12-01') }),
      ['dateTo'],
      'too_small',
    );
  });

  it('лише один із scheduleTimeFrom/To → [scheduleTimeTo] invalid_value; from >= to → too_small', async () => {
    await t.expectIssue(
      () => t.insert({ scheduleTimeFrom: '09:00' }),
      ['scheduleTimeTo'],
      'invalid_value',
    );
    await t.expectIssue(
      () => t.insert({ scheduleTimeFrom: '18:00', scheduleTimeTo: '09:00' }),
      ['scheduleTimeTo'],
      'too_small',
    );
    await t.expectIssue(
      () => t.insert({ scheduleTimeFrom: '09:00', scheduleTimeTo: '09:00' }),
      ['scheduleTimeTo'],
      'too_small',
    );
  });

  it('перехід section → home: обидва поля OK; лише placement → 400; home → section із sectionId OK', async () => {
    const sectionId = await t.seedSection();
    const id = await t.insert({ placement: 'section', sectionId });
    await t.expectIssue(
      () => t.update(id, { placement: 'home' }),
      ['sectionId'],
      'invalid_value',
    );
    await t.update(id, { placement: 'home', sectionId: null });
    expect(await t.row(id)).toMatchObject({
      placement: 'home',
      section_id: null,
    });
    await t.update(id, { placement: 'section', sectionId });
    expect(await t.row(id)).toMatchObject({
      placement: 'section',
      section_id: sectionId,
    });
  });

  it('guard бачить before: update проходить ЛИШЕ завдяки злитим значенням і падає ЛИШЕ через них', async () => {
    const sectionId = await t.seedSection();
    const id = await t.insert({ placement: 'section', sectionId });
    // Патч сам по собі не має sectionId, але злитий рядок валідний (before.sectionId).
    await t.update(id, { placement: 'section', title: 'Ок' });
    // Патч {sectionId:null} сам по собі валідний для home, але злитий з before.placement='section' — ні.
    await t.expectIssue(
      () => t.update(id, { sectionId: null }),
      ['sectionId'],
      'invalid_value',
    );
    const timed = await t.insert({
      scheduleTimeFrom: '09:00',
      scheduleTimeTo: '18:00',
    });
    // Патч {scheduleTimeTo:'08:00'} без before мав би лише одну межу; зі знімком — from >= to.
    await t.expectIssue(
      () => t.update(timed, { scheduleTimeTo: '08:00' }),
      ['scheduleTimeTo'],
      'too_small',
    );
    await t.update(timed, { scheduleTimeTo: '19:00' });
  });

  it('Е6д-12: розділ видалено → перемикач isActive працює; зміна placement/sectionId без розділу → 400', async () => {
    const sectionId = await t.seedSection();
    const id = await t.insert({ placement: 'section', sectionId });
    await t.q('delete from public.sections where id = $1', [sectionId]);
    expect(await t.row(id)).toMatchObject({
      placement: 'section',
      section_id: null,
    });
    await t.update(id, { isActive: false });
    await t.update(id, { isActive: true });
    await t.expectIssue(
      () => t.update(id, { placement: 'section' }),
      ['sectionId'],
      'invalid_value',
    );
    await t.expectIssue(
      () => t.update(id, { sectionId: null }),
      ['sectionId'],
      'invalid_value',
    );
    expect(await bannersOps.list({ data: {} })).toBeTruthy();
  });

  it('вітрина: банер section без розділу не віддається ні для розділу, ні без sectionId, ні як home', async () => {
    const sectionId = await t.seedSection();
    const id = await t.insert({ placement: 'section', sectionId });
    await t.q('delete from public.sections where id = $1', [sectionId]);
    const ids = async (query: { placement: string; sectionId?: string }) =>
      (await withStorefrontDb((db) => loadBanners(db, query))).map((b) => b.id);
    expect(await ids({ placement: 'section' })).not.toContain(id);
    expect(
      await ids({ placement: 'section', sectionId: crypto.randomUUID() }),
    ).not.toContain(id);
    expect(await ids({ placement: 'home' })).not.toContain(id);
  });
});
