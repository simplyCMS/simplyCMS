import { transliterateUk } from 'simplycms/domain/slugs';
import { messages as base } from '../catalogs/uk/base';
import { messages as admin } from '../catalogs/uk/admin/index';
import { messages as mail } from '../catalogs/uk/mail';
import type { LanguagePack } from '../types';

/** Українська: повний каталог інтерфейсу + транслітерація адрес за КМУ 2010. */
export const ukPack: LanguagePack = {
  code: 'uk',
  name: 'Українська',
  // М2а-TEMP: Task 3, коміт 3 — каталог стає ледачими частинами.
  catalog: { ...base, ...admin, ...mail },
  slugify: (text) => transliterateUk(text),
};
