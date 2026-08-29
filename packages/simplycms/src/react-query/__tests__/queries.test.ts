import { describe, it, expect } from 'vitest';
import { catalogKeys } from '../queries';

// 🔴 Що саме тут доводиться. Після знесення шару репозиторіїв від модуля
// лишився ОДИН контракт — форма ключів кешу. Вона не косметика: серверний
// лоадер (`storefront-routes/pages/home/queries.ts`) і клієнтський читач
// зустрічаються рівно в цій комірці, і мовчазна зміна форми дала б два
// незалежні кеші замість одного (урок колізії ключів головної).
describe('catalogKeys', () => {
  it('тримає стабільний префікс namespace', () => {
    expect(catalogKeys.all).toEqual(['catalog']);
    expect(catalogKeys.product('widget')).toEqual([
      'catalog',
      'product',
      'widget',
    ]);
    expect(catalogKeys.sections).toEqual(['catalog', 'sections']);
  });

  it('розділяє добірку секції за id і за запитом', () => {
    expect(catalogKeys.sectionProducts('s1')).toEqual([
      'catalog',
      'section-products',
      's1',
      null,
    ]);
    expect(catalogKeys.sectionProducts('s1', { page: 2 })).not.toEqual(
      catalogKeys.sectionProducts('s1'),
    );
  });

  it('ключ залишків залежить від повного набору id', () => {
    expect(catalogKeys.stock(['a', 'b'])).toEqual([
      'catalog',
      'stock',
      'a',
      'b',
    ]);
    expect(catalogKeys.stock(['a'])).not.toEqual(catalogKeys.stock(['a', 'b']));
  });
});
