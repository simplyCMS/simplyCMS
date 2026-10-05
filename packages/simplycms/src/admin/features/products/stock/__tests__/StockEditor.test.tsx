// @vitest-environment jsdom
/**
 * Клієнтська валідація залишку: від'ємне значення показує повідомлення про
 * КІЛЬКІСТЬ, а не про ціну (регресія ключа `admin.products.prices.invalid`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createTranslator, I18nProvider } from 'simplycms/i18n';
import { StockEditor } from '../StockEditor';

const mocks = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('sonner', () => ({
  toast: { error: mocks.toastError, success: vi.fn() },
}));
vi.mock('simplycms/core/hooks/useStock', () => ({
  usePickupPoints: () => ({ data: [{ id: 'pp-1' }] }),
  usePickupPointsCount: () => ({ data: 1 }),
}));
vi.mock('../useStock', async () => {
  // Реальний useStock повертає false на недійсному вводі; тут — та сама межа.
  const save = async (q: Record<string, string>) =>
    !Object.values(q).some(
      (v) => !Number.isInteger(Number(v)) || Number(v) < 0,
    );
  return { useStock: () => ({ rows: [], save }) };
});

afterEach(() => {
  cleanup();
  mocks.toastError.mockClear();
});

describe('StockEditor: валідація кількості', () => {
  it('від’ємний залишок → повідомлення про кількість, не про ціну', async () => {
    render(
      <I18nProvider locale="uk">
        <StockEditor productId="p" modificationId={null} showCard={false} />
      </I18nProvider>,
    );
    fireEvent.change(screen.getByLabelText('Кількість на складі'), {
      target: { value: '-1' },
    });
    fireEvent.click(screen.getByText('Зберегти залишки'));
    await vi.waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
    const t = createTranslator('uk');
    expect(mocks.toastError).toHaveBeenCalledWith(
      t('admin.products.stock.saveFailed', {
        message: t('admin.products.stock.invalidQuantity'),
      }),
    );
    expect(mocks.toastError.mock.calls[0][0]).not.toContain('ціна');
  });
});
