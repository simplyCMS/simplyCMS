import { describe, it, expect } from 'vitest';
import { ENTITY } from 'simplycms/contracts/entities';
import { catalogKeys } from '../queries';

// 🔴 Що саме тут доводиться. Після знесення шару репозиторіїв від модуля
// лишився ОДИН контракт — форма ключів кешу. Вона не косметика: серверний
// лоадер (`storefront-routes/pages/home/queries.ts`) і клієнтський читач
// зустрічаються рівно в цій комірці, і мовчазна зміна форми дала б два
// незалежні кеші замість одного (урок колізії ключів головної).
//
// 🔴 Сегмент 0 — імʼя таблиці з ENTITY, не рядок `'catalog'`: інакше
// вітрина й адмінка адресують ту саму сутність різними ключами (К3-3), і
// оновлення кешу в одному місці проминає записи в іншому.
describe('catalogKeys', () => {
  it('починається з імені сутності', () => {
    expect(catalogKeys.sectionProducts('s1')[0]).toBe(ENTITY.products);
  });

  it('розділяє добірку секції за id і за запитом', () => {
    expect(catalogKeys.sectionProducts('s1')).toEqual([
      ENTITY.products,
      'section',
      's1',
      null,
    ]);
    expect(catalogKeys.sectionProducts('s1', { page: 2 })).not.toEqual(
      catalogKeys.sectionProducts('s1'),
    );
  });
});
