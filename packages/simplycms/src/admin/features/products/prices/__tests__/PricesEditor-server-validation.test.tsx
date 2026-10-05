// @vitest-environment jsdom
/**
 * Тема 12: серверна відмова валідації ціни — помилка під ПОЛЕМ потрібного
 * виду ціни (позиційний `prices.<i>.price` → id виду), через реальну межу
 * serverFn; тост — лише для проблем без поля.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { I18nProvider } from 'simplycms/i18n';
import {
  serverValidationError,
  throughServerFnBoundary,
} from '../../../../lib/__tests__/support/serverfn-boundary';

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));

const types = [
  { id: 'pt-retail', name: 'Роздріб', isDefault: true, sortOrder: 0 },
  { id: 'pt-opt', name: 'Опт', isDefault: false, sortOrder: 1 },
];
const { saveProductPrices, listProductPrices, listPriceTypes } = vi.hoisted(
  () => ({
    saveProductPrices: vi.fn(),
    listProductPrices: vi.fn(async () => [] as unknown[]),
    listPriceTypes: vi.fn(async () => [] as unknown[]),
  }),
);
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({
    listProductPrices,
    saveProductPrices,
    listPriceTypes,
  }),
);

import { PricesEditor } from '../PricesEditor';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk">{children}</I18nProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  listPriceTypes.mockResolvedValue(types);
});
afterEach(() => cleanup());

async function fillAndSave(opt: string, retail = '') {
  const user = userEvent.setup();
  render(<PricesEditor productId="p1" modificationId={null} />, { wrapper });
  // Поля з’являються після завантаження видів цін.
  const optInput = await vi.waitFor(() => {
    const el = document.getElementById('price-pt-opt');
    if (!el) throw new Error('поле ще не відрендерене');
    return el;
  });
  if (retail)
    await user.type(document.getElementById('price-pt-retail')!, retail);
  await user.type(optInput, opt);
  await user.click(screen.getByRole('button', { name: 'Зберегти ціни' }));
}

describe('PricesEditor: помилки валідації сервера → поле', () => {
  it('path prices.1.price → повідомлення під «Опт», а не «Роздріб»', async () => {
    // Вхід на сервер: [роздріб, опт] (обидва непорожні) → індекс 1 = опт.
    saveProductPrices.mockRejectedValue(
      await throughServerFnBoundary(
        serverValidationError([
          {
            path: ['prices', 1, 'price'],
            code: 'invalid_format',
            params: { format: 'regex', origin: 'string' },
          },
        ]),
      ),
    );
    await fillAndSave('10', '5');

    const msg = await screen.findByText('Некоректний формат значення');
    expect(msg.id).toBe('price-pt-opt-error');
    expect(
      document.getElementById('price-pt-retail')!.getAttribute('aria-invalid'),
    ).toBe('false');
    expect(toastError).not.toHaveBeenCalled();
  });

  it('порожні види пропускаються в індексації: єдиний рядок входу = перший непорожній', async () => {
    saveProductPrices.mockRejectedValue(
      await throughServerFnBoundary(
        serverValidationError([
          {
            path: ['prices', 0, 'price'],
            code: 'invalid_decimal',
            params: { precision: 12, scale: 2 },
          },
        ]),
      ),
    );
    await fillAndSave('10'); // «Роздріб» порожній → у вхід іде лише «Опт» під індексом 0

    const msg = await screen.findByText(/Введіть число: до 12 цифр/);
    expect(msg.id).toBe('price-pt-opt-error');
  });

  it('проблема без поля → один загальний локалізований тост', async () => {
    saveProductPrices.mockRejectedValue(
      await throughServerFnBoundary(
        serverValidationError([{ path: ['prices'], code: 'custom' }]),
      ),
    );
    await fillAndSave('10');

    await vi.waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        'Дані не пройшли перевірку — виправте поля й спробуйте ще раз',
      ),
    );
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it('контроль без адаптера: поле не підсвічується', async () => {
    saveProductPrices.mockRejectedValue(
      await throughServerFnBoundary(
        serverValidationError([
          { path: ['prices', 0, 'price'], code: 'custom' },
        ]),
        { registered: false },
      ),
    );
    await fillAndSave('10');

    await vi.waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(document.getElementById('price-pt-opt-error')).toBeNull();
  });
});
