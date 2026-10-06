// К3-Е6б, Task 3: активація теми проти живої БД (Review Focus 4; налаштування —
// admin-system-theme-settings.test.ts).
// Лок `site-theme` доводиться детерміновано (`holdAdvisoryLock`/`stillPending`),
// а не випадковою перемогою гонки `Promise.all` (урок Е4: ~4 % червоних прогонів).
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { declareBuiltThemes } from 'simplycms/site';
import { holdAdvisoryLock, stillPending } from './fixtures/advisory-lock';
import * as F from './fixtures/admin-system';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

import { activateThemeOp } from 'simplycms/admin-server/impl';

const BUILT = ['default', 'solarstore'];

describe('admin: теми (Е6б, Task 3)', () => {
  const db = F.useSystemAdminDb('simplycms_admin_system_themes');
  const url = () => db.url();
  const active = async () =>
    (
      await F.rows(
        url(),
        'select name from public.themes where is_active order by name',
      )
    ).map((r) => r.name);
  const untilWaiting = (n: number) => F.untilAdvisoryWaiters(url(), n);

  beforeAll(async () => {
    declareBuiltThemes(BUILT);
    // Рядок вшитої теми пише bootstrap; тут — сід, плюс рядок теми, якої в збірці нема.
    for (const name of ['solarstore', 'ghost'])
      await F.rows(
        url(),
        `insert into public.themes (id, name, display_name) values ($1, $2, $3)`,
        [crypto.randomUUID(), name, name],
      );
  });

  it('activateTheme("solarstore") → рівно одна is_active, це solarstore; повтор — no-op', async () => {
    const list = await activateThemeOp({ data: { name: 'solarstore' } });
    expect(await active()).toEqual(['solarstore']);
    expect(list.filter((t) => t.isActive).map((t) => t.name)).toEqual([
      'solarstore',
    ]);
    await expect(
      activateThemeOp({ data: { name: 'solarstore' } }),
    ).resolves.toEqual(list);
    expect(await active()).toEqual(['solarstore']);
  });

  it('activateTheme рядка, якого немає у declareBuiltThemes → theme_not_built; активна тема незмінна', async () => {
    const before = await active();
    await expect(
      activateThemeOp({ data: { name: 'ghost' } }),
    ).rejects.toMatchObject(F.stateConflict('theme_not_built'));
    expect(await active()).toEqual(before);
  });

  it('вшита тема без рядка themes → theme_unknown; активна тема незмінна', async () => {
    const before = await active();
    declareBuiltThemes([...BUILT, 'nordic']);
    try {
      await expect(
        activateThemeOp({ data: { name: 'nordic' } }),
      ).rejects.toMatchObject(F.stateConflict('theme_unknown'));
    } finally {
      declareBuiltThemes(BUILT);
    }
    expect(await active()).toEqual(before);
  });

  it('activateTheme стоїть, поки зовнішній тримає site-theme (holdAdvisoryLock/stillPending); після release — одна активна', async () => {
    await activateThemeOp({ data: { name: 'solarstore' } });
    const lock = await holdAdvisoryLock(url(), 'site-theme');
    try {
      const op = activateThemeOp({ data: { name: 'default' } });
      expect(await stillPending(op, 300)).toBe(true);
      expect(await active()).toEqual(['solarstore']);
      await lock.release();
      await expect(op).resolves.toBeDefined();
      expect(await active()).toEqual(['default']);
    } finally {
      await lock.cleanup();
    }
  });

  it('дві активації різних тем під утриманим локом: обидві stillPending → release → обидві без помилки, рівно одна is_active', async () => {
    const lock = await holdAdvisoryLock(url(), 'site-theme');
    try {
      // Черга локу Postgres — FIFO: друга стає за першою, тож виконається другою.
      const first = activateThemeOp({ data: { name: 'solarstore' } });
      await untilWaiting(1);
      const second = activateThemeOp({ data: { name: 'default' } });
      await untilWaiting(2);
      expect(await stillPending(first, 300)).toBe(true);
      expect(await stillPending(second, 300)).toBe(true);
      await lock.release();
      await expect(Promise.all([first, second])).resolves.toHaveLength(2);
      expect(await active()).toEqual(['default']);
    } finally {
      await lock.cleanup();
    }
  });
});
