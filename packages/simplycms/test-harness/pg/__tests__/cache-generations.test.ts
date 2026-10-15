// Мультимовність М1, Task 5а (Д6): поколіннєвий кеш читання проти живої БД.
// «Дві репліки» — два НЕЗАЛЕЖНІ графи модулів (`vi.resetModules`): у кожного
// власні екземпляри `storeProfileCache`/`activeThemeCache` і власний пул, як у
// двох процесах. Мутація йде крізь реальні операції адмінки першого графа.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { withActor } from 'simplycms/db';
import { bumpCacheGeneration, declareBuiltThemes } from 'simplycms/site';
import type { CacheKey } from 'simplycms/site';
import * as F from './fixtures/admin-system';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

import {
  activateThemeOp,
  saveStoreProfileOp,
} from 'simplycms/admin-server/impl';

type Replica = {
  site: typeof import('simplycms/site');
  db: typeof import('simplycms/db');
};

describe('cache_generations: покоління кешів між репліками', () => {
  const db = F.useSystemAdminDb('simplycms_cache_generations');
  let replica: Replica;

  beforeAll(async () => {
    declareBuiltThemes(['default', 'solarstore']);
    await F.rows(
      db.url(),
      `insert into public.themes (id, name, display_name) values ($1, 'solarstore', 'solarstore')`,
      [crypto.randomUUID()],
    );
    // Друга «репліка»: свіжий граф модулів, а не той, що вже імпортовано вище.
    vi.resetModules();
    replica = {
      site: await import('simplycms/site'),
      db: await import('simplycms/db'),
    };
  }, 60_000);

  afterAll(async () => {
    await replica?.db.closeDbPool();
  });

  // Що кожен кеш читає й чим його мутують: профіль — назвою, тема — активною.
  const subjects = {
    storeProfile: {
      cache: () => replica.site.storeProfileCache,
      read: () =>
        replica.db.withActor({ role: 'app_user' }, (d) =>
          replica.site.readStoreProfile(d),
        ),
      mutate: (n: number) =>
        saveStoreProfileOp({ data: F.profile({ name: `Крамниця ${n}` }) }),
      expected: (n: number) =>
        expect.objectContaining({ name: `Крамниця ${n}` }),
    },
    activeTheme: {
      cache: () => replica.site.activeThemeCache,
      read: async () =>
        (
          await F.rows(
            db.url(),
            'select name from public.themes where is_active',
          )
        )[0]?.name,
      mutate: (n: number) =>
        activateThemeOp({ data: { name: n % 2 ? 'solarstore' : 'default' } }),
      expected: (n: number) => (n % 2 ? 'solarstore' : 'default'),
    },
  } as const;
  const names = Object.keys(subjects) as (keyof typeof subjects)[];

  it.each(names)(
    '%s: мутація першої репліки видна другій без очікування TTL',
    async (name) => {
      const s = subjects[name];
      const cache = s.cache() as {
        get(load: () => Promise<unknown>): Promise<unknown>;
      };
      await cache.get(s.read);
      await s.mutate(1);
      const load = vi.fn(s.read);
      expect(await cache.get(load)).toEqual(s.expected(1));
      expect(load).toHaveBeenCalledTimes(1);
    },
  );

  it.each(names)(
    '%s: без мутації load другої репліки не кличеться вдруге',
    async (name) => {
      const s = subjects[name];
      const cache = s.cache() as {
        get(load: () => Promise<unknown>): Promise<unknown>;
      };
      // Прогрів (міг перечитати після мутацій попередніх кейсів), далі — тиша.
      await cache.get(s.read);
      const load = vi.fn(s.read);
      await cache.get(load);
      await cache.get(load);
      expect(load).not.toHaveBeenCalled();
    },
  );

  it('сід містить три ключі, app_user їх читає', async () => {
    const gens = await replica.site.readGenerations();
    expect([...gens.keys()].sort()).toEqual([
      'active-theme',
      'languages',
      'store-profile',
    ]);
  });

  it('bumpCacheGeneration незасіяного ключа → помилка, транзакція відкочується', async () => {
    await expect(
      withActor({ role: 'app_admin' }, (d) =>
        bumpCacheGeneration(d, 'nonexistent' as CacheKey),
      ),
    ).rejects.toThrow(/не засіяно/);
  });

  it('відкат транзакції мутації не піднімає покоління', async () => {
    const before = await replica.site.readGenerations();
    await expect(
      withActor({ role: 'app_admin' }, async (d) => {
        await bumpCacheGeneration(d, 'languages');
        throw new Error('відкат');
      }),
    ).rejects.toThrow('відкат');
    expect(await replica.site.readGenerations()).toEqual(before);
  });
});
