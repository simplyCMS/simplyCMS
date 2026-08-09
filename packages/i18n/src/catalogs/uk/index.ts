/**
 * Український каталог — джерело правди набору ключів.
 *
 * `MessageKey` виводиться саме звідси (`keyof typeof messages`), тож новий ключ
 * додається спершу тут; решта каталогів — часткові й падають у fallback на uk.
 *
 * 🔴 Каталог зведено spread-ом із неймспейсних модулів, бо повний набір ключів
 * не вміщається в ліміт 150 рядків на файл. Ціна цього рішення — дублікат ключа
 * у двох модулях перетерся б МОВЧКИ; стереже `catalog-integrity.test.ts`, який
 * звіряє суму ключів модулів із розміром зведеного обʼєкта.
 */
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
import { messages as admin } from './admin/index';

export const messages = {
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
  ...admin,
} satisfies Record<string, string>;
