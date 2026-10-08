import { vi } from 'vitest';

/**
 * Моки межі serverFn. Окремий модуль без імпорту сторінки: фабрика `vi.mock`
 * завантажує його динамічно, а сторінка тягне `simplycms/admin-server`.
 */
export const mocks = {
  listCustomers: vi.fn(),
  listUserCategories: vi.fn(async () => [] as unknown[]),
};
