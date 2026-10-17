// @vitest-environment jsdom
/**
 * Картка товару, фікс-раунд 1: версія береться з відповіді команди; помилка
 * поля неактивної вкладки перемикає вкладку; `saveStock` не затирає ручний
 * (ще не збережений) статус; введене під час запиту переживає перечитування;
 * ручний статус модифікації їде в тому ж `saveDescription`.
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
  setProductPath: vi.fn(),
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

const MOD = '99999999-9999-4999-8999-999999999999';
const two = (agg: ReturnType<typeof aggregate>) => ({
  ...agg,
  texts: {
    ...agg.texts,
    en: { ...agg.texts.uk, name: 'Panel' },
  },
  paths: { uk: 'panel', en: 'panel-en' },
});
const withMod = () => {
  const a = aggregate(true);
  return {
    ...a,
    modifications: [
      {
        id: MOD,
        sku: null,
        isDefault: true,
        sortOrder: 0,
        stockStatus: 'in_stock',
        texts: {
          uk: { name: 'Мод', status: 'current', fieldStatus: {} },
        },
        token: { uk: 'mod' },
      },
    ],
  };
};

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <EngineProvider value={ENGINE}>
        <I18nProvider locale="uk">{children}</I18nProvider>
      </EngineProvider>
    </QueryClientProvider>
  );
}
const LANGS2 = [
  ...LANGUAGES,
  {
    code: 'en',
    name: 'English',
    status: 'published',
    isDefault: false,
    sortOrder: 1,
    hasPack: true,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getProduct.mockResolvedValue(two(aggregate(false)));
  mocks.listLanguages.mockResolvedValue(LANGS2);
  mocks.saveProductDescription.mockResolvedValue({ version: 2 });
  mocks.setProductPath.mockResolvedValue({ version: 4 });
});
afterEach(() => cleanup());

const open = async () => {
  render(<ProductEditPage productId={ID} />, { wrapper });
  await screen.findByDisplayValue('Панель');
};
const save = () => screen.getAllByRole('button', { name: 'Зберегти' })[0]!;

describe('картка: версія з відповіді команди', () => {
  it('setPath -> версія 4 -> «Зберегти» шле expectedVersion 4', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('tab', { name: /English/ }));
    const input = screen.getByLabelText(/Адреса \(URL\)/);
    await user.clear(input);
    await user.type(input, 'wire');
    await user.click(screen.getByRole('button', { name: 'Зберегти адресу' }));
    await waitFor(() => expect(mocks.setProductPath).toHaveBeenCalled());
    await user.type(screen.getByLabelText(/Назва/), '!');
    await user.click(save());
    await waitFor(() =>
      expect(mocks.saveProductDescription).toHaveBeenCalled(),
    );
    expect(mocks.saveProductDescription.mock.calls[0]![0].data).toMatchObject({
      expectedVersion: 4,
    });
  });

  it('після setPath повернення на вкладку показує нову адресу', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('tab', { name: /English/ }));
    const input = screen.getByLabelText(/Адреса \(URL\)/);
    await user.clear(input);
    await user.type(input, 'wire');
    await user.click(screen.getByRole('button', { name: 'Зберегти адресу' }));
    await waitFor(() => expect(mocks.setProductPath).toHaveBeenCalled());
    await user.click(screen.getByRole('tab', { name: /Українська/ }));
    await user.click(screen.getByRole('tab', { name: /English/ }));
    expect(
      (screen.getByLabelText(/Адреса \(URL\)/) as HTMLInputElement).value,
    ).toBe('wire');
  });
});

describe('картка: помилка неактивної вкладки', () => {
  it('помилка en.metaTitle при активній uk -> вкладка en активна, тост є', async () => {
    mocks.saveProductDescription.mockRejectedValueOnce(
      Object.assign(new Error('v'), {
        name: 'ValidationError',
        issues: [{ path: ['texts', 'en', 'metaTitle'], code: 'too_big' }],
      }),
    );
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('tab', { name: /English/ }));
    await user.type(screen.getByLabelText('Meta Title'), 'x');
    await user.click(screen.getByRole('tab', { name: /Українська/ }));
    await user.type(screen.getByLabelText(/Назва/), '!');
    await user.click(save());

    await waitFor(() =>
      expect(
        screen
          .getByRole('tab', { name: /English/ })
          .getAttribute('aria-selected'),
      ).toBe('true'),
    );
    expect(toastError).toHaveBeenCalled();
    expect(screen.getAllByRole('img', { name: 'Є помилки' }).length).toBe(1);
  });
});

describe('картка: saveStock і ручний статус', () => {
  it('ручний (незбережений) статус saveStock НЕ затирає', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('button', { name: 'status:in_stock' }));
    await user.click(screen.getByRole('button', { name: 'stock-saved' }));
    await user.click(save());
    await waitFor(() =>
      expect(mocks.saveProductDescription).toHaveBeenCalled(),
    );
    expect(mocks.saveProductDescription.mock.calls[0]![0].data.base).toEqual({
      stockStatus: 'out_of_stock',
    });
  });

  it('без ручної правки статус від saveStock потрапляє у форму й знімок (зайвого збереження немає)', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('button', { name: 'stock-saved' }));
    await screen.findByRole('button', { name: 'status:on_order' });
    await user.click(save());
    await new Promise((r) => setTimeout(r, 50));
    expect(mocks.saveProductDescription).not.toHaveBeenCalled();
  });
});

describe('картка: ручний статус модифікації', () => {
  it('статус із діалогу їде в modifications.upsert того самого запиту', async () => {
    mocks.getProduct.mockResolvedValue(two(withMod() as never));
    const user = userEvent.setup();
    render(<ProductEditPage productId={ID} />, { wrapper });
    await user.click(await screen.findByText('Мод'));
    await user.click(
      await screen.findByRole('button', { name: 'status:in_stock' }),
    );
    await user.click(screen.getByRole('button', { name: 'Застосувати' }));
    await user.click(save());
    await waitFor(() =>
      expect(mocks.saveProductDescription).toHaveBeenCalled(),
    );
    expect(
      mocks.saveProductDescription.mock.calls[0]![0].data.modifications,
    ).toEqual({ upsert: [{ id: MOD, stockStatus: 'out_of_stock' }] });
  });
});

describe('картка: введене під час запиту', () => {
  it('поле, змінене після відправки, переживає перечитування', async () => {
    let finish!: (v: { version: number }) => void;
    mocks.saveProductDescription.mockReturnValueOnce(
      new Promise((r) => (finish = r)),
    );
    const user = userEvent.setup();
    await open();
    await user.type(screen.getByLabelText(/Назва/), ' 1');
    await user.click(save());
    await waitFor(() =>
      expect(mocks.saveProductDescription).toHaveBeenCalled(),
    );
    await user.type(screen.getByLabelText(/Назва/), '2');
    mocks.getProduct.mockResolvedValue({
      ...two(aggregate(false)),
      version: 2,
      texts: {
        ...two(aggregate(false)).texts,
        uk: { ...aggregate(false).texts.uk, name: 'Панель 1' },
      },
    });
    finish({ version: 2 });
    await waitFor(() => expect(mocks.getProduct).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect((screen.getByLabelText(/Назва/) as HTMLInputElement).value).toBe(
        'Панель 12',
      ),
    );
  });
});
