import { vi } from 'vitest';

/**
 * Моки межі serverFn і побічних ефектів картки. Окремий модуль без імпорту
 * сторінки: фабрика `vi.mock` завантажує його динамічно.
 */
export const mocks = {
  getCustomerCard: vi.fn(),
  listUserCategories: vi.fn(async () => [] as unknown[]),
  listOrders: vi.fn(async () => [] as unknown[]),
  assignCustomerCategory: vi.fn(),
  updateCustomerContacts: vi.fn(),
  setAdminRole: vi.fn(),
  setCustomerBan: vi.fn(),
  deleteCustomer: vi.fn(),
};

export const ui = {
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  navigate: vi.fn(),
  currentUserId: 'a0000000-0000-4000-8000-0000000000ff',
};
