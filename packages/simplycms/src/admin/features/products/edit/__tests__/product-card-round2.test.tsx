// @vitest-environment jsdom
/**
 * Картка товару, фікс-раунд 2: ручний статус МОДИФІКАЦІЇ vs `saveStock`
 * (чернетка і поле діалогу), бейдж назви модифікації, клієнтська помилка
 * неактивної вкладки.
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
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));
vi.mock('simplycms/core/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('../../../../components/RichTextEditor', () => ({
  RichTextEditor: () => null,
}));
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
const withMod = (enStatus = 'current') => {
  const a = aggregate(true);
  return {
    ...a,
    // Товар із модифікаціями власного sku не має.
    base: { ...a.base, sku: null },
    modifications: [
      {
        id: MOD,
        sku: null,
        isDefault: true,
        sortOrder: 0,
        stockStatus: 'in_stock',
        texts: {
          uk: { name: 'Мод', status: 'current', fieldStatus: {} },
          en: { name: 'Mod', status: enStatus, fieldStatus: {} },
        },
        token: { uk: 'mod' },
      },
    ],
  };
};
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
  mocks.getProduct.mockResolvedValue(withMod());
  mocks.listLanguages.mockResolvedValue(LANGS2);
  mocks.saveProductDescription.mockResolvedValue({ version: 2 });
});
afterEach(() => cleanup());

const save = () => screen.getAllByRole('button', { name: 'Зберегти' })[0]!;
const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByText('Мод'));
  await screen.findByRole('button', { name: /^status:/ });
};
const sentUpsert = () =>
  mocks.saveProductDescription.mock.calls[0]![0].data.modifications;

describe('ручний статус модифікації vs saveStock', () => {
  it('чернетка з ручним статусом: saveStock її не міняє (знімок оновлено)', async () => {
    const user = userEvent.setup();
    render(<ProductEditPage productId={ID} />, { wrapper });
    await openDialog(user);
    await user.click(screen.getByRole('button', { name: 'status:in_stock' }));
    await user.click(screen.getByRole('button', { name: 'Застосувати' }));
    await openDialog(user);
    await user.click(screen.getByRole('button', { name: 'stock-saved' }));
    await user.keyboard('{Escape}');
    await user.click(save());
    await waitFor(() =>
      expect(mocks.saveProductDescription).toHaveBeenCalled(),
    );
    // знімок став on_order, ручний out_of_stock лишився й іде в запит
    expect(sentUpsert()).toEqual({
      upsert: [{ id: MOD, stockStatus: 'out_of_stock' }],
    });
  });

  it('без ручної правки saveStock оновлює чернетку й знімок (збереження не потрібне)', async () => {
    const user = userEvent.setup();
    render(<ProductEditPage productId={ID} />, { wrapper });
    await openDialog(user);
    await user.click(screen.getByRole('button', { name: 'stock-saved' }));
    await screen.findByRole('button', { name: 'status:on_order' });
    await user.keyboard('{Escape}');
    await user.click(save());
    await new Promise((r) => setTimeout(r, 50));
    expect(mocks.saveProductDescription).not.toHaveBeenCalled();
  });

  it('відкритий діалог: dirty-поле статусу saveStock не перезаписує', async () => {
    const user = userEvent.setup();
    render(<ProductEditPage productId={ID} />, { wrapper });
    await openDialog(user);
    await user.click(screen.getByRole('button', { name: 'status:in_stock' }));
    await screen.findByRole('button', { name: 'status:out_of_stock' });
    await user.click(screen.getByRole('button', { name: 'stock-saved' }));
    expect(
      screen.getByRole('button', { name: 'status:out_of_stock' }),
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Застосувати' }));
    await user.click(save());
    await waitFor(() =>
      expect(mocks.saveProductDescription).toHaveBeenCalled(),
    );
    expect(sentUpsert()).toEqual({
      upsert: [{ id: MOD, stockStatus: 'out_of_stock' }],
    });
  });
});

describe('бейдж назви модифікації', () => {
  it('застарілий переклад назви показано біля поля мови; актуальний — ні', async () => {
    mocks.getProduct.mockResolvedValue(withMod('outdated'));
    const user = userEvent.setup();
    const { unmount } = render(<ProductEditPage productId={ID} />, { wrapper });
    await openDialog(user);
    const label = document.querySelector('label[for="mod-name-en"]')!;
    expect(label.textContent).toContain('Застарілий');
    unmount();
    mocks.getProduct.mockResolvedValue(withMod('current'));
    render(<ProductEditPage productId={ID} />, { wrapper });
    await openDialog(user);
    expect(
      document.querySelector('label[for="mod-name-en"]')!.textContent,
    ).not.toContain('Застарілий');
  });
});

describe('клієнтська помилка неактивної вкладки', () => {
  it('порожня назва основної мови при активній en -> вкладка uk активна й позначена', async () => {
    const a = aggregate(false);
    mocks.getProduct.mockResolvedValue({
      ...a,
      texts: { en: { ...a.texts.uk, name: 'Panel' } },
    });
    const user = userEvent.setup();
    render(<ProductEditPage productId={ID} />, { wrapper });
    await user.click(await screen.findByRole('tab', { name: /English/ }));
    await user.click(save());
    await waitFor(() =>
      expect(
        screen
          .getByRole('tab', { name: /Українська/ })
          .getAttribute('aria-selected'),
      ).toBe('true'),
    );
    expect(screen.getAllByRole('img', { name: 'Є помилки' })).toHaveLength(1);
    expect(mocks.saveProductDescription).not.toHaveBeenCalled();
  });
});
