// @vitest-environment jsdom
// Валідатор цін (Task 10): кожна причина відхилення — перекладеним текстом,
// а не кодом; condition_unknown / condition_invalid / discount_invalid — три
// різні рядки. Форма шле на сервер вхід діагностики.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { DiscountRejectionReason } from 'simplycms/contracts';
import { createTranslator, I18nProvider } from 'simplycms/i18n';
import { EngineProvider } from 'simplycms/react-query';
import { ENGINE } from '../../../products/edit/__tests__/test-engine-stub';
import { stubDom } from '../../__tests__/render-support';
import { REJECTION_REASON_KEY } from '../rejection-reasons';

stubDom();
const t = createTranslator('uk');
const m = vi.hoisted(() => ({
  diagnosePrice: vi.fn(),
  searchProductsForOrder: vi.fn(),
  findCustomers: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(m),
);

import PriceValidatorPage from '../PriceValidatorPage';

const REASONS = Object.keys(REJECTION_REASON_KEY) as DiscountRejectionReason[];
const diagnosis = (reasons: DiscountRejectionReason[]) => ({
  priceTypeId: null,
  categoryId: null,
  available: true,
  basePrice: 1000,
  finalPrice: 900,
  applied: [],
  rejected: reasons.map((reason, i) => ({
    id: `d${i}`,
    name: `Знижка ${i}`,
    groupName: 'Група',
    reason,
    conditionType: reason === 'condition_failed' ? 'min_quantity' : null,
  })),
});

async function runWith(reasons: DiscountRejectionReason[]) {
  m.diagnosePrice.mockResolvedValue(diagnosis(reasons));
  m.searchProductsForOrder.mockResolvedValue({
    items: [
      { productId: 'p1', name: 'Панель', sku: null, hasModifications: false },
    ],
  });
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <EngineProvider value={ENGINE}>
        <I18nProvider locale="uk">{children}</I18nProvider>
      </EngineProvider>
    </QueryClientProvider>
  );
  render(<PriceValidatorPage />, { wrapper });
  fireEvent.change(
    screen.getByPlaceholderText(t('admin.orders.searchPlaceholder')),
    { target: { value: 'Панель' } },
  );
  fireEvent.click(
    await screen.findByRole('button', { name: /Панель/ }, { timeout: 2000 }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: t('admin.validator.run') }),
  );
  await screen.findByText(t('admin.validator.result'));
}

describe('PriceValidator: причини відхилення', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('lost_to_operator показано перекладеним текстом, а не кодом', async () => {
    await runWith(['lost_to_operator']);
    expect(
      screen.getByText(t('admin.validator.reason.lost_to_operator')),
    ).toBeTruthy();
    expect(screen.queryByText('lost_to_operator')).toBeNull();
  });

  it('усі коди мають окремий непорожній переклад; unknown/invalid/discount_invalid — різні', async () => {
    const texts = REASONS.map((r) => t(REJECTION_REASON_KEY[r]));
    expect(new Set(texts).size).toBe(REASONS.length);
    for (const r of REASONS) expect(texts).not.toContain(r);
    await runWith(REASONS);
    for (const text of texts) expect(screen.getByText(text)).toBeTruthy();
  });

  it('шле вхід діагностики: гість, товар, кількість, сума решти кошика', async () => {
    await runWith([]);
    await waitFor(() =>
      expect(m.diagnosePrice).toHaveBeenCalledWith({
        data: {
          userId: null,
          productId: 'p1',
          modificationId: null,
          quantity: 1,
          otherCartTotal: 0,
        },
      }),
    );
  });
});
