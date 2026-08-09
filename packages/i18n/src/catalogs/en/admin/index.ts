/** Каталог адмінки — дзеркало `uk/admin/index.ts`. */
import type { Catalog } from '../../../types';
import { messages as common } from './common';
import { messages as nav } from './nav';
import { messages as dashboard } from './dashboard';
import { messages as plugins } from './plugins';

export const messages: Catalog = {
  ...common,
  ...nav,
  ...dashboard,
  ...plugins,
};
