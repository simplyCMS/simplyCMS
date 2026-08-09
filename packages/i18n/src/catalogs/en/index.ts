/**
 * Англійський каталог — частковий за контрактом (`Catalog = Partial<…>`):
 * відсутній ключ віддає українське повідомлення, а не порожній рядок.
 *
 * 🔴 Тобто «переклад є» і «переклад повний» — різні твердження, і типом друге
 * не доводиться. Повноту стереже `tests/i18n-catalog-parity.test.ts`.
 *
 * Структура модулів — дзеркало `uk/`, файл у файл: розбіжність розкладки
 * побачить той самий parity-тест.
 */
import type { Catalog } from '../../types';
import { messages as common } from './common';
import { messages as validation } from './validation';
import { messages as nav } from './nav';
import { messages as breadcrumbs } from './breadcrumbs';
import { messages as cart } from './cart';
import { messages as auth } from './auth';

export const messages: Catalog = {
  ...common,
  ...validation,
  ...nav,
  ...breadcrumbs,
  ...cart,
  ...auth,
};
