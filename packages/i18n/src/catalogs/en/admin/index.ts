/** Каталог адмінки — дзеркало `uk/admin/index.ts`. */
import type { Catalog } from '../../../types';
import { messages as banners } from './banners';
import { messages as common } from './common';
import { messages as nav } from './nav';
import { messages as dashboard } from './dashboard';
import { messages as orders } from './orders';
import { messages as plugins } from './plugins';
import { messages as prices } from './prices';
import { messages as properties } from './properties';
import { messages as reviews } from './reviews';
import { messages as sections } from './sections';
import { messages as shipping } from './shipping';
import { messages as themes } from './themes';

export const messages: Catalog = {
  ...banners,
  ...common,
  ...nav,
  ...dashboard,
  ...orders,
  ...plugins,
  ...prices,
  ...properties,
  ...reviews,
  ...sections,
  ...shipping,
  ...themes,
};
