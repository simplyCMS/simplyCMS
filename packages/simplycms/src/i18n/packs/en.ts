import { messages } from '../catalogs/en/index';
import type { LanguagePack } from '../types';

/** Англійська: частковий каталог; таблиці адрес немає — латиниця йде як є. */
export const enPack: LanguagePack = {
  code: 'en',
  name: 'English',
  catalog: messages,
};
