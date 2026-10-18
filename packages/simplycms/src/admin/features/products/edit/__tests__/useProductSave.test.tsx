// @vitest-environment jsdom
/**
 * `useProductCreate` (М1, Task 13; фінальне рев'ю B-I2): `products.create` з id наперед —
 * ОДНА команда разом із фото; помилка сервера лягає на поле, а не губить введене; після
 * успіху — навігація на картку, навіть якщо перечитування списку впало.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from 'simplycms/i18n';
import type { ReactNode } from 'react';

const mocks = vi.hoisted(() => ({
  createProduct: vi.fn(),
  saveProductDescription: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(mocks),
);
// Перечитування списку товарів — керований мок: збій після створення не має блокувати навігацію.
const { refetchMock } = vi.hoisted(() => ({
  refetchMock: vi.fn(async () => undefined),
}));
vi.mock('simplycms/admin-data', async (orig) => ({
  ...(await orig<typeof import('simplycms/admin-data')>()),
  useCollection: () => ({ utils: { refetch: refetchMock } }),
}));
const navigateMock = vi.fn();
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigateMock }));
const { toastSuccess, toastError, toastInfo } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { success: toastSuccess, error: toastError, info: toastInfo },
}));

import { blankForm } from '../product-aggregate';
import { useProductCreate } from '../useProductSave';

const ID = '11111111-1111-4111-8111-111111111111';
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    <I18nProvider locale="uk">{children}</I18nProvider>
  </QueryClientProvider>
);
const sink = () => ({
  setFormError: vi.fn(),
  setModificationError: vi.fn(),
  setValueError: vi.fn(),
});
const values = () => {
  const v = blankForm(['uk']);
  v.texts.uk!.name = 'Панель';
  v.path = 'panel';
  return v;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createProduct.mockResolvedValue({ id: ID, version: 1, paths: {} });
  mocks.saveProductDescription.mockResolvedValue({ version: 2 });
});
afterEach(() => cleanup());

describe('useProductCreate', () => {
  it('create: products.create з id наперед і адресою, далі навігація на картку', async () => {
    const { result } = renderHook(() => useProductCreate(ID, sink(), 'uk'), {
      wrapper,
    });
    await result.current(values());

    expect(mocks.createProduct).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: ID,
        path: 'panel',
        texts: { uk: { name: 'Панель' } },
      }),
    });
    expect(mocks.saveProductDescription).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith('Товар створено');
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/admin/products/$productId',
      params: { productId: ID },
    });
  });

  it('фото йдуть у ТІЙ САМІЙ команді products.create, другого кроку немає', async () => {
    const v = values();
    v.images = [
      { id: ID, storageKey: 'k', sortOrder: 0, alt: {}, overrides: {} },
    ];
    const { result } = renderHook(() => useProductCreate(ID, sink(), 'uk'), {
      wrapper,
    });
    await result.current(v);

    expect(mocks.createProduct).toHaveBeenCalledTimes(1);
    expect(mocks.createProduct).toHaveBeenCalledWith({
      data: expect.objectContaining({ images: { upsert: [v.images[0]] } }),
    });
    expect(mocks.saveProductDescription).not.toHaveBeenCalled();
  });

  it('збій перечитування списку після створення — все одно навігація на картку', async () => {
    const { result } = renderHook(() => useProductCreate(ID, sink(), 'uk'), {
      wrapper,
    });
    refetchMock.mockRejectedValueOnce(new Error('мережа'));
    await result.current(values());

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/admin/products/$productId',
      params: { productId: ID },
    });
  });

  it('помилка адреси — на поле path, навігації немає', async () => {
    mocks.createProduct.mockRejectedValueOnce(
      Object.assign(new Error('x'), {
        name: 'ValidationError',
        issues: [{ path: ['path'], code: 'path_required' }],
      }),
    );
    const s = sink();
    const { result } = renderHook(() => useProductCreate(ID, s, 'uk'), {
      wrapper,
    });
    await result.current(values());

    expect(s.setFormError).toHaveBeenCalledWith('path', expect.any(String));
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('адреса, яку генератор змінив (зайнята → -2), показана користувачу', async () => {
    mocks.createProduct.mockResolvedValue({
      id: ID,
      version: 1,
      paths: { uk: 'panel-2' },
    });
    const { result } = renderHook(() => useProductCreate(ID, sink(), 'uk'), {
      wrapper,
    });
    await result.current(values());
    expect(toastInfo).toHaveBeenCalledWith(expect.stringContaining('panel-2'));
  });
});
