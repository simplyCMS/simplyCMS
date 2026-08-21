/**
 * Каталог адмінки: зводить доменні модулі в один обʼєкт.
 *
 * Вкладений рівень існує через ліміт 150 рядків на файл — адмінка дає більшу
 * частину ключів ядра. Інваріант «файл = неймспейс» тримається й тут:
 * `admin/products.ts` віддає лише `admin.products.*`
 * (`catalog-integrity.test.ts` розбирає й вкладений рівень).
 */
import { messages as banners } from './banners';
import { messages as common } from './common';
import { messages as discounts } from './discounts';
import { messages as nav } from './nav';
import { messages as dashboard } from './dashboard';
import { messages as orders } from './orders';
import { messages as plugins } from './plugins';
import { messages as prices } from './prices';
import { messages as products } from './products';
import { messages as properties } from './properties';
import { messages as reviews } from './reviews';
import { messages as sections } from './sections';
import { messages as settings } from './settings';
import { messages as shipping } from './shipping';
import { messages as themes } from './themes';
import { messages as users } from './users';
import { messages as validator } from './validator';

export const messages = {
  ...banners,
  ...common,
  ...discounts,
  ...nav,
  ...dashboard,
  ...orders,
  ...plugins,
  ...prices,
  ...products,
  ...properties,
  ...reviews,
  ...sections,
  ...settings,
  ...shipping,
  ...themes,
  ...users,
  ...validator,
} satisfies Record<string, string>;
