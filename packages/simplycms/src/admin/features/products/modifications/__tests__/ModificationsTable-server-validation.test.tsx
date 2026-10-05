// @vitest-environment jsdom
/**
 * Тема 12 (якір боргу №15: `ModificationsTable.tsx`): відмова валідації
 * сервера при видаленні модифікації — локалізований тост, а не сирий JSON.
 * Полів у таблиці немає, тож помилка йде загальним ключем
 * `admin.validation.failed` (через `reportTxError`/`adminErrorKey`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { I18nProvider } from 'simplycms/i18n';
import type { ProductModification } from 'simplycms/schema/types';
import {
  serverValidationError,
  throughServerFnBoundary,
} from '../../../../lib/__tests__/support/serverfn-boundary';

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));

vi.mock('simplycms/react-query', () => ({
  useFormatPrice: () => (v: unknown) => String(v),
}));

const { listProductPrices, listPriceTypes } = vi.hoisted(() => ({
  listProductPrices: vi.fn(async () => [] as unknown[]),
  listPriceTypes: vi.fn(async () => [] as unknown[]),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({ listProductPrices, listPriceTypes }),
);

import { ModificationsTable } from '../ModificationsTable';
import type { useModifications } from '../useModifications';

const MOD: ProductModification = {
  id: 'm1',
  productId: 'p1',
  slug: '100w',
  name: 'Модифікація 100w',
  sku: 'SKU-1',
  images: [],
  sortOrder: 0,
  stockStatus: 'in_stock',
  isDefault: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <I18nProvider locale="uk">{children}</I18nProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('ModificationsTable: помилка валідації при видаленні', () => {
  async function deleteWith(error: Error) {
    const remove = vi.fn(() => ({
      isPersisted: { promise: Promise.reject(error) },
    }));
    const data = {
      modifications: [MOD],
      reorder: vi.fn(),
      remove,
    } as unknown as ReturnType<typeof useModifications>;
    const user = userEvent.setup();
    render(<ModificationsTable productId="p1" data={data} onEdit={vi.fn()} />, {
      wrapper,
    });
    // Кнопка видалення рядка — остання в рядку (іконка кошика).
    const rowButtons = screen.getAllByRole('button');
    await user.click(rowButtons[rowButtons.length - 1]!);
    await user.click(await screen.findByRole('button', { name: 'Видалити' }));
  }

  it('після межі serverFn: загальний локалізований тост, без сирого JSON', async () => {
    await deleteWith(
      await throughServerFnBoundary(
        serverValidationError([{ path: ['0', 'id'], code: 'invalid_format' }]),
      ),
    );
    await vi.waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        'Дані не пройшли перевірку — виправте поля й спробуйте ще раз',
      ),
    );
    expect(String(toastError.mock.calls[0]![0])).not.toMatch(/\{|\[/);
  });

  it('контроль без адаптера: тост із сирим службовим повідомленням (дефект, який лікує адаптер)', async () => {
    await deleteWith(
      await throughServerFnBoundary(
        serverValidationError([{ path: ['0', 'id'], code: 'invalid_format' }]),
        { registered: false },
      ),
    );
    await vi.waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(toastError.mock.calls[0]![0]).toContain('[admin-server]');
  });
});
