import { transliterateUk } from 'simplycms/domain/slugs';
import { messages } from '../catalogs/uk/index';
import type { LanguagePack } from '../types';

/** Українська: повний каталог інтерфейсу + транслітерація адрес за КМУ 2010. */
export const ukPack: LanguagePack = {
  code: 'uk',
  name: 'Українська',
  catalog: messages,
  slugify: (text) => transliterateUk(text),
};
