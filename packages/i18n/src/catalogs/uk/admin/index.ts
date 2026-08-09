/**
 * Каталог адмінки: зводить доменні модулі в один обʼєкт.
 *
 * Вкладений рівень існує через ліміт 150 рядків на файл — адмінка дає більшу
 * частину ключів ядра. Інваріант «файл = неймспейс» тримається й тут:
 * `admin/products.ts` віддає лише `admin.products.*`
 * (`catalog-integrity.test.ts` розбирає й вкладений рівень).
 */
import { messages as common } from './common';
import { messages as nav } from './nav';
import { messages as dashboard } from './dashboard';
import { messages as plugins } from './plugins';
import { messages as properties } from './properties';

export const messages = {
  ...common,
  ...nav,
  ...dashboard,
  ...plugins,
  ...properties,
} satisfies Record<string, string>;
