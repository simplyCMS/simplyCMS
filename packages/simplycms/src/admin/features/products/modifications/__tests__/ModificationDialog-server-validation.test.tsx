// @vitest-environment jsdom
/**
 * Тема 12: RHF-форма модифікації — серверна відмова валідації `slug`
 * стає помилкою ПОЛЯ (`form.setError`), а не тостом; поле без відображення
 * (`sku`) — загальний локалізований тост.
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

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));

vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(),
);

import { ModificationDialog } from '../ModificationDialog';
import type { ModificationFormValues } from '../modification-form-schema';

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

async function submitWith(error: Error) {
  const onUpdate = vi.fn(
    async (_id: string, _v: ModificationFormValues): Promise<void> => {
      throw error;
    },
  );
  const onOpenChange = vi.fn();
  render(
    <ModificationDialog
      open
      onOpenChange={onOpenChange}
      productId="p1"
      sectionId={null}
      mod={MOD}
      onCreate={vi.fn()}
      onUpdate={onUpdate}
    />,
    { wrapper },
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Зберегти' }));
  await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
  return { onOpenChange };
}

describe('ModificationDialog: помилки валідації сервера → поле форми', () => {
  it('path [slug] → повідомлення в полі slug, діалог лишається відкритим, тосту нема', async () => {
    const { onOpenChange } = await submitWith(
      await throughServerFnBoundary(
        serverValidationError([
          {
            path: ['slug'],
            code: 'too_big',
            params: { origin: 'string', maximum: 255 },
          },
        ]),
      ),
    );

    const msg = await screen.findByText(
      'Занадто довго: не більше 255 символів',
    );
    expect(msg.id).toBe('mod-slug-error');
    expect(
      document.getElementById('mod-slug')!.getAttribute('aria-invalid'),
    ).toBe('true');
    expect(toastError).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('path [sku] (поле без відображення помилки) → загальний тост, а не мовчання', async () => {
    await submitWith(
      await throughServerFnBoundary(
        serverValidationError([{ path: ['sku'], code: 'too_big' }]),
      ),
    );
    await vi.waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        'Дані не пройшли перевірку — виправте поля й спробуйте ще раз',
      ),
    );
  });

  it('контроль без адаптера: поле не підсвічується', async () => {
    await submitWith(
      await throughServerFnBoundary(
        serverValidationError([{ path: ['slug'], code: 'too_big' }]),
        { registered: false },
      ),
    );
    await vi.waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(
      document.getElementById('mod-slug')!.getAttribute('aria-invalid'),
    ).toBe('false');
  });
});
