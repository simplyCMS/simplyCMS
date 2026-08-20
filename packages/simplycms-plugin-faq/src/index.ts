import { definePlugin } from 'simplycms/plugin-sdk';
import { FaqSlot } from './FaqSlot';
import { messages } from './messages';
import { settings } from './settings';

/**
 * Референс-плагін ПОВНОГО контуру SDK (план Фази 3, Р11): власна таблиця
 * `plg_faq_items` (міграція їде в пакеті, накат — `simplycms db:diff
 * --write` + ревʼю), adminRoutes `/admin/faq`, слот на сторінці товару,
 * Zod-настройки і власний каталог i18n.
 */
export default definePlugin({
  name: 'faq',
  displayName: 'FAQ',
  version: '0.3.0',
  engines: { simplycms: '>=0.3.0' },
  // Метадані реєстру — англійською (конвенція Р6 плану Фази 3).
  description:
    'Reference FAQ plugin: product questions and answers with admin CRUD.',
  author: 'SimplyCMS',
  settings,
  slots: { 'product.detail.after': FaqSlot },
  messages,
  adminRoutes: './routes',
  migrations: ['20260814120000_plg_faq_items.sql'],
});

export type { FaqItem } from './types';
