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
import { messages as app } from './app';
import { messages as common } from './common';
import { messages as validation } from './validation';
import { messages as nav } from './nav';
import { messages as breadcrumbs } from './breadcrumbs';
import { messages as home } from './home';
import { messages as catalog } from './catalog';
import { messages as product } from './product';
import { messages as properties } from './properties';
import { messages as profile } from './profile';
import { messages as cart } from './cart';
import { messages as checkout } from './checkout';
import { messages as auth } from './auth';
import { messages as reviews } from './reviews';
import { messages as admin } from './admin/index';

export const messages: Catalog = {
  ...app,
  ...common,
  ...validation,
  ...nav,
  ...breadcrumbs,
  ...home,
  ...catalog,
  ...product,
  ...properties,
  ...profile,
  ...cart,
  ...checkout,
  ...auth,
  ...reviews,
  ...admin,
};
