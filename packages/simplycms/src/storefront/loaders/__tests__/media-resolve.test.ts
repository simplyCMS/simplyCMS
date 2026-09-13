import { describe, expect, it } from 'vitest';
import type { ActorDb } from '../db';
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

  it('toBanner резолвить усі три колонки', () => {
    const banner = toBanner({
      image_url: KEY,
      desktop_image_url: DATA,
      mobile_image_url: null,
      buttons: [],
      schedule_days: null,
    } as never);
    expect(banner.image_url).toBe(`/media/${KEY}`);
    expect(banner.desktop_image_url).toBe(DATA);
    expect(banner.mobile_image_url).toBeNull();
  });

  it('toSectionRow і toOptionRow резолвлять image_url', () => {
    expect(toSectionRow({ image_url: KEY } as never).image_url).toBe(
      `/media/${KEY}`,
    );
    expect(toOptionRow({ image_url: null } as never).image_url).toBeNull();
  });
});

/**
 * Підміна `db` замість живого пулу: `loadReviewAuthors` — не мапер, а лоадер,
 * тож довести резолв на чистій функції неможливо; проганяємо саме її тіло.
 * Ланцюг `select().from().where()` — рівно той, який будує Drizzle.
 */
const dbWithRows = (rows: readonly unknown[]): ActorDb =>
  ({
    select: () => ({ from: () => ({ where: () => Promise.resolve(rows) }) }),
  }) as unknown as ActorDb;

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
