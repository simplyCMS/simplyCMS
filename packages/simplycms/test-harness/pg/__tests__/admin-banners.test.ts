// К3-Е6д, Task 3: CRUD ресурсу банерів і поелементні правила `refine`
// (Review Focus 5, `overlay_color`). Перехресні правила — `-guard`.
import { describe, expect, it, vi } from 'vitest';
import { bannersOps } from 'simplycms/admin-server/impl';
import { BTN, useBannersDb } from './fixtures/admin-banners';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

describe('admin: ресурс банерів (Е6д, Task 3)', () => {
  const t = useBannersDb('simplycms_e6d_banners');

  it('мінімальний insert → OK, placement=home, section_id NULL (р4 B2)', async () => {
    const id = await t.insert();
    expect(await t.row(id)).toMatchObject({
      placement: 'home',
      section_id: null,
      schedule_time_from: null,
    });
  });

  it('CRUD: insert → update → list → remove', async () => {
    const id = await t.insert({ buttons: [{ ...BTN, text: '  Піти  ' }] });
    expect((await t.row(id)).buttons).toEqual([{ ...BTN, text: 'Піти' }]);
    await t.update(id, { title: 'Нова', scheduleDays: [] });
    expect(await t.row(id)).toMatchObject({
      title: 'Нова',
      schedule_days: null,
    });
    const list = await bannersOps.list({ data: {} });
    expect(list.map((r) => r.id)).toContain(id);
    await expect(bannersOps.remove({ data: [{ id }] })).resolves.toEqual({
      count: 1,
    });
  });

  it('update {title} на банері з time «09:00:00» (як повертає Postgres) → OK', async () => {
    const id = await t.insert({
      scheduleTimeFrom: '09:00',
      scheduleTimeTo: '18:00',
    });
    expect((await t.row(id)).schedule_time_from).toBe('09:00:00');
    await t.update(id, { title: 'Інша' });
    expect(await t.row(id)).toMatchObject({ title: 'Інша' });
  });

  const tooMany = [BTN, BTN, BTN, BTN];
  it.each<[string, Record<string, unknown>, (string | number)[]]>([
    ['placement поза enum', { placement: 'sidebar' }, ['placement']],
    ['textPosition поза enum', { textPosition: 'top' }, ['textPosition']],
    ['animationType поза enum', { animationType: 'spin' }, ['animationType']],
    ['4 кнопки', { buttons: tooMany }, ['buttons']],
    [
      'кнопка javascript:',
      { buttons: [{ ...BTN, url: 'javascript:alert(1)' }] },
      ['buttons', 0],
    ],
    [
      'кнопка //',
      { buttons: [{ ...BTN, url: '//evil.test' }] },
      ['buttons', 0],
    ],
    ['scheduleDays дубль', { scheduleDays: [1, 1] }, ['scheduleDays']],
    ['scheduleDays [7]', { scheduleDays: [7] }, ['scheduleDays', 0]],
    [
      'scheduleTimeFrom 25:00',
      { scheduleTimeFrom: '25:00' },
      ['scheduleTimeFrom'],
    ],
    ['slideDuration 999', { slideDuration: 999 }, ['slideDuration']],
    ['slideDuration 15001', { slideDuration: 15001 }, ['slideDuration']],
    ['animationDuration 99', { animationDuration: 99 }, ['animationDuration']],
    [
      'overlayColor ін’єкція',
      { overlayColor: 'red; background:url(x)' },
      ['overlayColor'],
    ],
    ['порожній title', { title: '   ' }, ['title']],
    ['порожній imageUrl', { imageUrl: '' }, ['imageUrl']],
  ])('відмова: %s (insert і update)', async (_n, bad, path) => {
    await t.expectIssue(() => t.insert(bad), path);
    const id = await t.insert();
    await t.expectIssue(() => t.update(id, bad), path);
  });
});
