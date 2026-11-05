import { transliterateUk } from 'simplycms/domain/slugs';
import type { LanguagePack } from '../types';

/**
 * Українська: повний каталог інтерфейсу (частини вантажаться динамічним `import()` —
 * кожна стає окремим чанком) + транслітерація адрес за КМУ 2010.
 */
export const ukPack: LanguagePack = {
  code: 'uk',
  name: 'Українська',
  ui: {
    base: () => import('../catalogs/uk/base').then((m) => m.messages),
    admin: () => import('../catalogs/uk/admin/index').then((m) => m.messages),
    mail: () => import('../catalogs/uk/mail').then((m) => m.messages),
  },
  content: { slugify: (text) => transliterateUk(text) },
};
