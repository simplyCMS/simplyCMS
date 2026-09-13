import { describe, expect, it } from 'vitest';
import type { ActorDb } from '../db';
import { loadProfile } from '../profile';
import { loadReviewAuthors } from '../reviews';
import { toImageList } from '../entities/product';
import { toBanner } from '../entities/banner';
import { toSectionRow } from '../entities/section';
import { toOptionRow } from '../entities/property';

const KEY = 'ab/ab000000-0000-4000-8000-000000000000.png';
const DATA = 'data:image/svg+xml;charset=utf-8,<svg/>';

describe('резолв медіа-референсів у лоадерах', () => {
  it('toImageList: key → URL, data:/http: — незмінно, сміття викинуто', () => {
    expect(
      toImageList([KEY, DATA, 'https://e.com/a.jpg', '', 42, null]),
    ).toEqual([`/media/${KEY}`, DATA, 'https://e.com/a.jpg']);
  });

  it('toImageList на не-масиві лишається порожнім масивом', () => {
    expect(toImageList(null)).toEqual([]);
    expect(toImageList('нема')).toEqual([]);
  });

  // 🔴 РЕФЕРЕНС у ВСІ ТРИ колонки. Попередня редакція подавала в дві з них
  // `data:`-URL і `null` — значення, які `resolveMediaUrl` і так повертає
  // незмінними, тож зняття резолву саме там фікстура не бачила.
  it('toBanner резолвить усі три колонки', () => {
    const banner = toBanner({
      image_url: KEY,
      desktop_image_url: KEY,
      mobile_image_url: KEY,
      buttons: [],
      schedule_days: null,
    } as never);
    expect(banner.image_url).toBe(`/media/${KEY}`);
    expect(banner.desktop_image_url).toBe(`/media/${KEY}`);
    expect(banner.mobile_image_url).toBe(`/media/${KEY}`);
  });

  it('toBanner лишає data:-URL і null як є', () => {
    const banner = toBanner({
      image_url: KEY,
      desktop_image_url: DATA,
      mobile_image_url: null,
      buttons: [],
      schedule_days: null,
    } as never);
    expect(banner.desktop_image_url).toBe(DATA);
    expect(banner.mobile_image_url).toBeNull();
  });

  it('toSectionRow і toOptionRow резолвлять image_url', () => {
    expect(toSectionRow({ image_url: KEY } as never).image_url).toBe(
      `/media/${KEY}`,
    );
    expect(toOptionRow({ image_url: KEY } as never).image_url).toBe(
      `/media/${KEY}`,
    );
    expect(toOptionRow({ image_url: null } as never).image_url).toBeNull();
  });
});

/**
 * Підміна `db` замість живого пулу: лоадер — не мапер, тож довести резолв на
 * чистій функції неможливо; проганяємо саме його тіло.
 *
 * 🔴 Ланцюг будується узагальнено (кожен крок повертає сам себе, а `await`
 * віддає рядки), бо форми в лоадерів різні: `loadReviewAuthors` — це
 * `select().from().where()`, `loadProfile` — ще й `leftJoin()` і `limit()`.
 * Drizzle-білдер так само thenable, тож підміна відповідає справжній формі.
 */
const dbWithRows = (rows: readonly unknown[]): ActorDb => {
  const chain: Record<string, unknown> = {
    then: (resolve: (value: readonly unknown[]) => void) => resolve(rows),
  };
  for (const step of ['select', 'from', 'leftJoin', 'where', 'limit'])
    chain[step] = () => chain;
  return chain as unknown as ActorDb;
};

describe('loadReviewAuthors резолвить avatar_url', () => {
  it('референс → /media/…, зовнішній URL — незмінно, null — null', async () => {
    const authors = await loadReviewAuthors(
      dbWithRows([
        { user_id: 'u1', first_name: 'А', last_name: null, avatar_url: KEY },
        {
          user_id: 'u2',
          first_name: 'Б',
          last_name: null,
          avatar_url: 'https://e.com/a.jpg',
        },
        { user_id: 'u3', first_name: 'В', last_name: null, avatar_url: null },
      ]),
      ['u1', 'u2', 'u3'],
    );

    expect(authors.u1?.avatar_url).toBe(`/media/${KEY}`);
    expect(authors.u2?.avatar_url).toBe('https://e.com/a.jpg');
    expect(authors.u3?.avatar_url).toBeNull();
  });
});

describe('loadProfile резолвить avatar_url', () => {
  it('референс власного профілю стає /media/…', async () => {
    const profile = await loadProfile(
      dbWithRows([
        {
          first_name: 'А',
          last_name: null,
          email: null,
          phone: null,
          avatar_url: KEY,
          category_name: null,
        },
      ]),
      'u1',
    );
    expect(profile?.avatar_url).toBe(`/media/${KEY}`);
  });

  it('зовнішній URL і null лишаються як є', async () => {
    const external = await loadProfile(
      dbWithRows([{ avatar_url: 'https://e.com/a.jpg', category_name: null }]),
      'u2',
    );
    expect(external?.avatar_url).toBe('https://e.com/a.jpg');

    const empty = await loadProfile(
      dbWithRows([{ avatar_url: null, category_name: null }]),
      'u3',
    );
    expect(empty?.avatar_url).toBeNull();
  });
});
