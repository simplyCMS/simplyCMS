/** Каталог адмінки — дзеркало `uk/admin/index.ts`. */
import type { Catalog } from '../../../types';
import { messages as common } from './common';
import { messages as nav } from './nav';
import { messages as dashboard } from './dashboard';
import { messages as plugins } from './plugins';
import { messages as prices } from './prices';
import { messages as properties } from './properties';
import { messages as sections } from './sections';

export const messages: Catalog = {
  ...common,
  ...nav,
  ...dashboard,
  ...plugins,
  ...prices,
  ...properties,
  ...sections,
};
