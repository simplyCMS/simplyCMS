// @vitest-environment jsdom
/**
 * Тема 12: відмова валідації сервера при автозбереженні властивості — помилка
 * біля поля властивості (`errors[propertyId]`), без загального тосту.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { I18nProvider } from 'simplycms/i18n';
import {
  serverValidationError,
  throughServerFnBoundary,
} from '../../../../lib/__tests__/support/serverfn-boundary';

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));

const { listProductPropertyValues, insertProductPropertyValues } = vi.hoisted(
  () => ({
    listProductPropertyValues: vi.fn(async () => [] as unknown[]),
    insertProductPropertyValues: vi.fn(),
  }),
);
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({
    listProductPropertyValues,
    insertProductPropertyValues,
  }),
);

import { usePropertyValues } from '../usePropertyValues';

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <I18nProvider locale="uk">{children}</I18nProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

const draft = { value: '5', numericValue: '5', optionId: null };

describe('usePropertyValues: помилки валідації сервера', () => {
  it('numericValue → помилка біля поля властивості, тосту нема; наступне збереження її скидає', async () => {
    insertProductPropertyValues.mockRejectedValueOnce(
      await throughServerFnBoundary(
        serverValidationError([
          {
            path: ['0', 'numericValue'],
            code: 'invalid_decimal',
            params: { precision: 15, scale: 4 },
          },
        ]),
      ),
    );
    const { result } = renderHook(() => usePropertyValues('product', 'p1'), {
      wrapper,
    });

    result.current.saveScalar('propA', draft);
    await waitFor(() =>
      expect(result.current.errors.propA).toBe(
        'Введіть число: до 15 цифр, із них 4 після коми',
      ),
    );
    expect(toastError).not.toHaveBeenCalled();

    insertProductPropertyValues.mockResolvedValueOnce([]);
    result.current.saveScalar('propA', draft);
    await waitFor(() => expect(result.current.errors.propA).toBeUndefined());
  });

  it('проблема не на значенні → загальний локалізований тост', async () => {
    insertProductPropertyValues.mockRejectedValueOnce(
      await throughServerFnBoundary(
        serverValidationError([{ path: ['0', 'productId'], code: 'custom' }]),
      ),
    );
    const { result } = renderHook(() => usePropertyValues('product', 'p1'), {
      wrapper,
    });
    result.current.saveScalar('propA', draft);
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(toastError.mock.calls[0]![0]).toContain('Дані не пройшли перевірку');
  });
});
