import { describe, expect, it, vi } from 'vitest';
import { insertPluginRow } from '../server/table-db';

vi.mock('simplycms/storefront/loaders', () => ({
  withStorefrontDb: vi.fn(),
  withStoreOperatorDb: vi.fn(),
}));

describe('порт плагіна: id обовʼязковий', () => {
  it('insertPluginRow без id кидає з поясненням', async () => {
    await expect(
      insertPluginRow('faq', 'plg_faq_items', { question: 'q', answer: 'a' }),
    ).rejects.toThrow(/id/i);
  });

  it('повідомлення називає таблицю і плагін', async () => {
    await expect(
      insertPluginRow('faq', 'plg_faq_items', { question: 'q' }),
    ).rejects.toThrow(/plg_faq_items/);
  });

  it('порожній рядок як id теж відхиляється', async () => {
    await expect(
      insertPluginRow('faq', 'plg_faq_items', { id: '', question: 'q' }),
    ).rejects.toThrow(/id/i);
  });
});
