import { describe, expect, it } from 'vitest';
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
