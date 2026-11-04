/**
 * Англійська частина `base` — повна (`satisfies Record<BaseKey, string>`): пропущений
 * ключ не компілюється. Структура модулів — дзеркало `uk/`, файл у файл.
 */
import type { BaseKey } from '../../types';
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
import { messages as orders } from './orders';
import { messages as auth } from './auth';
import { messages as reviews } from './reviews';
import { messages as errors } from './errors';

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
  ...orders,
  ...auth,
  ...reviews,
  ...errors,
} satisfies Record<BaseKey, string>;
