// @vitest-environment jsdom
/**
 * Фінальне рев'ю М1 (B M1): після власного збереження перечитаний агрегат новіший за версію
 * відповіді (чужий запис у вікні між ними). Стор лишає версію збереження, тож наступне
 * «Зберегти» дає 412 і діалог, а не тихо відтворює чуже видалення чи перезаписує чужу правку.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { I18nProvider } from 'simplycms/i18n';
import { EngineProvider } from 'simplycms/react-query';
import { ENGINE, ResizeObserverStub } from './test-engine-stub';
import { aggregate, ID, LANGUAGES } from './ProductEditPage-fixtures';

vi.stubGlobal('ResizeObserver', ResizeObserverStub);
const mocks = vi.hoisted(() => ({
  getProduct: vi.fn(),
  listLanguages: vi.fn(),
  saveProductDescription: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(mocks),
);
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('sonner', () => ({
  toast: {
    error: toastError,
    success: vi.fn(),
    info: vi.fn(),
  },
}));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));
vi.mock('simplycms/core/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('../../../../components/RichTextEditor', () => ({
  RichTextEditor: () => null,
}));
// Radix Select у jsdom не працює: контроли статусу й залишків — кнопки.
vi.mock('../../stock/StockStatusSelect', () => ({
  StockStatusSelect: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <button type="button" onClick={() => onChange('out_of_stock')}>
      status:{value}
    </button>
  ),
}));
vi.mock('../../stock/StockEditor', () => ({
  StockEditor: ({ onStatus }: { onStatus: (s: string) => void }) => (
    <button type="button" onClick={() => onStatus('on_order')}>
      stock-saved
    </button>
  ),
}));
vi.mock('../../prices/PricesEditor', () => ({ PricesEditor: () => null }));

import { ProductEditPage } from '../ProductEditPage';

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <EngineProvider value={ENGINE}>
        <I18nProvider locale="uk">{children}</I18nProvider>
      </EngineProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listLanguages.mockResolvedValue(LANGUAGES);
  // Відкриття — версія 1; власне збереження — 2; перечитування після нього — 4: між
  // збереженням і перечитуванням записав інший редактор.
  mocks.getProduct
    .mockResolvedValueOnce(aggregate(false, 1))
    .mockResolvedValue(aggregate(false, 4));
  mocks.saveProductDescription.mockResolvedValue({ version: 2 });
});
afterEach(() => cleanup());

const save = () => screen.getAllByRole('button', { name: 'Зберегти' })[0]!;

describe('картка: чужий запис між збереженням і перечитуванням (B M1)', () => {
  it('наступне збереження шле версію власного збереження, а не перечитану — сервер дасть 412', async () => {
    const user = userEvent.setup();
    render(<ProductEditPage productId={ID} />, { wrapper });
    await screen.findByDisplayValue('Панель');
    await user.type(screen.getByLabelText(/Назва/), '!');
    await user.click(save());
    await waitFor(() => expect(mocks.getProduct).toHaveBeenCalledTimes(2));
    await user.type(screen.getByLabelText(/Назва/), '?');
    await user.click(save());
    await waitFor(() =>
      expect(mocks.saveProductDescription).toHaveBeenCalledTimes(2),
    );
    expect(mocks.saveProductDescription.mock.calls[1]![0].data).toMatchObject({
      expectedVersion: 2,
    });
  });

  it('адресу, змінену іншим редактором, поле показує після перечитування (B M6)', async () => {
    mocks.getProduct
      .mockReset()
      .mockResolvedValueOnce(aggregate(false, 1))
      .mockResolvedValue({
        ...aggregate(false, 4),
        paths: { uk: 'panel-new' },
      });
    const user = userEvent.setup();
    render(<ProductEditPage productId={ID} />, { wrapper });
    await screen.findByDisplayValue('panel');
    await user.type(screen.getByLabelText(/Назва/), '!');
    await user.click(save());
    expect(await screen.findByDisplayValue('panel-new')).toBeDefined();
  });
});
