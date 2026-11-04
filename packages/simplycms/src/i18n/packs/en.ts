import { messages as base } from '../catalogs/en/base';
import { messages as admin } from '../catalogs/en/admin/index';
import { messages as mail } from '../catalogs/en/mail';
import type { LanguagePack } from '../types';

/** Англійська: частковий каталог; таблиці адрес немає — латиниця йде як є. */
export const enPack: LanguagePack = {
  code: 'en',
  name: 'English',
  // М2а-TEMP: Task 3, коміт 3 — каталог стає ледачими частинами.
  catalog: { ...base, ...admin, ...mail },
};
