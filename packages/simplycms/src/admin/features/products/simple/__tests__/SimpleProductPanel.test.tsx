// @vitest-environment jsdom
/**
 * `SimpleProductPanel`: статус наявності — поле чернетки картки (`base.stockStatus`),
 * а не миттєвий запис над рядком: жодної мережі до «Зберегти» картки. Коли
 * `saveStock` виводить статус із залишків, форма отримує його назад.
 *
 * `StockStatusSelect` замокано кнопкою — реальний Radix Select у jsdom 30
 * не має `hasPointerCapture`/`scrollIntoView` (`ProductsPage.test.tsx`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { UseFormReturn } from 'react-hook-form';
import { CardHarness, PRODUCT_ID } from '../../__tests__/card-harness';
import type { ProductFormValues } from '../../edit/product-form-schema';

vi.mock('../../stock/StockStatusSelect', () => ({
  StockStatusSelect: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <button onClick={() => onChange('out_of_stock')}>status:{value}</button>
  ),
}));
vi.mock('../../stock/StockEditor', () => ({
  StockEditor: ({ onStatus }: { onStatus: (s: string) => void }) => (
    <button onClick={() => onStatus('on_order')}>stock-saved</button>
  ),
}));
vi.mock('../../prices/PricesEditor', () => ({ PricesEditor: () => null }));
const mocks = vi.hoisted(() => ({ updateProducts: vi.fn() }));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({}),
);

import { SimpleProductPanel } from '../SimpleProductPanel';

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

function renderPanel() {
  let form!: UseFormReturn<ProductFormValues>;
  render(
    <CardHarness onForm={(f) => (form = f)}>
      <SimpleProductPanel productId={PRODUCT_ID} />
    </CardHarness>,
  );
  return () => form;
}

describe('SimpleProductPanel: статус наявності — поле чернетки', () => {
  it('вибір статусу міняє форму і не йде в мережу', async () => {
    const form = renderPanel();
    (await screen.findByRole('button', { name: 'status:in_stock' })).click();
    expect(form().getValues('stockStatus')).toBe('out_of_stock');
    expect(mocks.updateProducts).not.toHaveBeenCalled();
  });

  it('статус, виведений saveStock, іде до картки (вона вирішує, чи не затирає ручний вибір)', async () => {
    const onStockStatus = vi.fn();
    render(
      <CardHarness card={{ onStockStatus }}>
        <SimpleProductPanel productId={PRODUCT_ID} />
      </CardHarness>,
    );
    (await screen.findByRole('button', { name: 'stock-saved' })).click();
    expect(onStockStatus).toHaveBeenCalledWith(null, 'on_order');
  });
});
