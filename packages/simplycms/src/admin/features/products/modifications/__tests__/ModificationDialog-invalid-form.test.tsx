// @vitest-environment jsdom
/**
 * Невалідна форма модифікації (рев'ю): submit із невалідним slug —
 * інлайн-помилка під полем, тост `admin.products.fixFields`, onCreate НЕ
 * викликано. Мутація: прибрати onInvalid із form.handleSubmit → тост не
 * показано → червоне.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { I18nProvider } from 'simplycms/i18n';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({}),
);
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));

import { ModificationDialog } from '../ModificationDialog';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk">{children}</I18nProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('ModificationDialog: невалідний slug — інлайн-помилка й тост', () => {
  it('submit із невалідним slug: помилка під полем, тост, onCreate НЕ викликано', async () => {
    const onCreate = vi.fn();
    render(
      <ModificationDialog
        open
        onOpenChange={vi.fn()}
        productId="p1"
        sectionId={null}
        mod={null}
        onCreate={onCreate}
        onUpdate={vi.fn()}
      />,
      { wrapper },
    );

    fireEvent.change(screen.getByLabelText('Назва *'), {
      target: { value: 'Panel' },
    });
    fireEvent.change(screen.getByLabelText('URL (slug) *'), {
      target: { value: 'Panel-1' }, // невалідно: великі літери
    });
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }));

    const error = await screen.findByRole('alert');
    expect(error.textContent).toBe(
      'Латиниця, цифри й дефіс — наприклад, wireless-mouse-100w',
    );
    expect(toastError).toHaveBeenCalledWith('Перевірте виділені поля');
    expect(onCreate).not.toHaveBeenCalled();
  });
});
