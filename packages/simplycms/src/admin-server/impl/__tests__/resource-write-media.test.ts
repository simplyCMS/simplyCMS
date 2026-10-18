import { describe, expect, it } from 'vitest';
import { banners } from 'simplycms/schema';
import { assertMediaColumns } from '../resource-write-media';

// М1 Task 17 fix-1 (A2): опція `media` фабрики — лише text-колонки. jsonb-масив як
// `media` прибрано разом із єдиним носієм (`products.images`): рубіж конфігу мусить
// відмовити гучно, а не прийняти нетестовану семантику диффу масиву.
describe('assertMediaColumns: media — лише text', () => {
  it('text-колонка (`banners.image_url`) — приймається', () => {
    const media = { entityType: 'banner' as const, columns: ['imageUrl'] };
    expect(assertMediaColumns(banners, media)).toBe(media);
  });

  it('jsonb-колонка (`banners.buttons`) — помилка конфігу', () => {
    expect(() =>
      assertMediaColumns(banners, {
        entityType: 'banner',
        columns: ['buttons'],
      }),
    ).toThrow('banners.buttons: media-колонка мусить бути text');
  });

  it('не-текстова колонка (`banners.sort_order`) — помилка конфігу', () => {
    expect(() =>
      assertMediaColumns(banners, {
        entityType: 'banner',
        columns: ['sortOrder'],
      }),
    ).toThrow(/мусить бути text/);
  });
});
