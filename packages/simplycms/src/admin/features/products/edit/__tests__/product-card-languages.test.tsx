// @vitest-environment jsdom
/**
 * Картка товару з вкладками мов на командах агрегата (М1, Task 13): одна
 * кнопка — один `saveDescription`; незмінена вкладка у `texts` не йде (І11);
 * 412 відкриває діалог і не скидає введене; статуси полів; адреса — окремою
 * командою; нова модифікація їде в тому ж запиті.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { I18nProvider } from 'simplycms/i18n';
import { EngineProvider } from 'simplycms/react-query';
import { ENGINE, ResizeObserverStub } from './test-engine-stub';

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
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));
vi.mock('simplycms/core/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
// Tiptap у jsdom не потрібен: опис підміняється звичайним полем.
vi.mock('../../../../components/RichTextEditor', () => ({
  RichTextEditor: () => null,
}));

import { ProductEditPage } from '../ProductEditPage';

const ID = '11111111-1111-4111-8111-111111111111';
const row = (
  name: string,
  status: string,
  fieldStatus: Record<string, string> = {},
) => ({
  name,
  shortDescription: null,
  description: null,
  metaTitle: null,
  metaDescription: null,
  status,
  fieldStatus: {
    name: 'current',
    shortDescription: 'current',
    description: 'current',
    metaTitle: 'current',
    metaDescription: 'current',
    ...fieldStatus,
  },
});

const aggregate = (extra: object = {}) => ({
  id: ID,
  version: 3,
  base: {
    sectionId: null,
    sku: null,
    isActive: true,
    isFeatured: false,
    hasModifications: false,
    stockStatus: 'in_stock',
  },
  texts: {
    uk: row('Кабель', 'current'),
    en: row('Cable', 'outdated', { name: 'outdated' }),
  },
  paths: { uk: 'kabel', en: 'cable' },
  modifications: [],
  propertyValues: [],
  images: [],
  ...extra,
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <EngineProvider value={ENGINE}>
        <I18nProvider locale="uk">{children}</I18nProvider>
      </EngineProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getProduct.mockResolvedValue(aggregate());
  mocks.listLanguages.mockResolvedValue([
    {
      code: 'uk',
      name: 'Українська',
      status: 'published',
      isDefault: true,
      sortOrder: 0,
      hasPack: true,
    },
    {
      code: 'en',
      name: 'English',
      status: 'published',
      isDefault: false,
      sortOrder: 1,
      hasPack: true,
    },
  ]);
  mocks.saveProductDescription.mockResolvedValue({ version: 4 });
  mocks.setProductPath.mockResolvedValue({ version: 4 });
});
afterEach(() => cleanup());

const open = async () => {
  render(<ProductEditPage productId={ID} />, { wrapper });
  await screen.findByDisplayValue('Кабель');
};
const saveButton = () =>
  screen.getAllByRole('button', { name: 'Зберегти' })[0]!;

describe('картка товару: вкладки мов і команди агрегата', () => {
  it('одна кнопка шле один saveDescription з texts усіх змінених вкладок', async () => {
    const user = userEvent.setup();
    await open();
    await user.type(screen.getByLabelText(/Назва/), ' 2');
    await user.click(screen.getByRole('tab', { name: /English/ }));
    await user.type(screen.getByLabelText(/Назва/), ' 2');
    await user.click(saveButton());

    await waitFor(() =>
      expect(mocks.saveProductDescription).toHaveBeenCalledTimes(1),
    );
    expect(mocks.saveProductDescription).toHaveBeenCalledWith({
      data: {
        id: ID,
        expectedVersion: 3,
        texts: { uk: { name: 'Кабель 2' }, en: { name: 'Cable 2' } },
      },
    });
  });

  it('незмінена вкладка не потрапляє в texts', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('tab', { name: /English/ }));
    await user.type(screen.getByLabelText(/Назва/), '!');
    await user.click(saveButton());

    await waitFor(() =>
      expect(mocks.saveProductDescription).toHaveBeenCalled(),
    );
    const sent = mocks.saveProductDescription.mock.calls[0]![0].data;
    expect(Object.keys(sent.texts)).toEqual(['en']);
  });

  it('412 → діалог конфлікту, введене збережено; «Перезавантажити» — свідомо', async () => {
    mocks.saveProductDescription.mockRejectedValueOnce(
      Object.assign(new Error('v'), {
        name: 'VersionMismatchError',
        currentVersion: 4,
      }),
    );
    const user = userEvent.setup();
    await open();
    await user.type(screen.getByLabelText(/Назва/), ' мій');
    await user.click(saveButton());

    await screen.findByText('Товар змінив хтось інший');
    // Мовчки нічого не скинуто й не перечитано.
    expect((screen.getByLabelText(/Назва/) as HTMLInputElement).value).toBe(
      'Кабель мій',
    );
    expect(mocks.getProduct).toHaveBeenCalledTimes(1);

    mocks.getProduct.mockResolvedValue(
      aggregate({ version: 4, texts: { uk: row('Чужий', 'current') } }),
    );
    await user.click(screen.getByRole('button', { name: 'Перезавантажити' }));
    await screen.findByDisplayValue('Чужий');
  });

  it('статус outdated показано на полі', async () => {
    const user = userEvent.setup();
    await open();
    const nameLabel = () =>
      screen.getByLabelText(/Назва/).id === 'product-name'
        ? document.querySelector('label[for="product-name"]')!
        : null;
    // Джерело статусу не має, на вкладці en поле «Назва» застаріле.
    expect(nameLabel()!.textContent).not.toContain('Застарілий');
    await user.click(screen.getByRole('tab', { name: /English/ }));
    expect(nameLabel()!.textContent).toContain('Застарілий');
    const short = document.querySelector(
      'label[for="product-short-description"]',
    )!;
    expect(short.textContent).not.toContain('Застарілий');
  });

  it('шлях редагується окремо й шле setPath', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('tab', { name: /English/ }));
    const input = screen.getByLabelText(/Адреса \(URL\)/);
    await user.clear(input);
    await user.type(input, 'wire');
    await user.click(screen.getByRole('button', { name: 'Зберегти адресу' }));

    await waitFor(() => expect(mocks.setProductPath).toHaveBeenCalledTimes(1));
    expect(mocks.setProductPath).toHaveBeenCalledWith({
      data: { id: ID, locale: 'en', path: 'wire', expectedVersion: 3 },
    });
    expect(mocks.saveProductDescription).not.toHaveBeenCalled();
  });

  it('нова модифікація потрапляє в modifications.upsert того самого запиту', async () => {
    mocks.getProduct.mockResolvedValue(
      aggregate({
        base: { ...aggregate().base, hasModifications: true },
      }),
    );
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('button', { name: 'Додати' }));
    await user.type(await screen.findByLabelText(/Назва.*\(uk\)/), '100W');
    await user.click(screen.getByRole('button', { name: 'Застосувати' }));
    await user.click(saveButton());

    await waitFor(() =>
      expect(mocks.saveProductDescription).toHaveBeenCalled(),
    );
    const sent = mocks.saveProductDescription.mock.calls[0]![0].data;
    expect(sent.modifications.upsert).toEqual([
      {
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        sortOrder: 0,
        texts: { uk: { name: '100W' } },
      },
    ]);
    expect(mocks.saveProductDescription).toHaveBeenCalledTimes(1);
  });
});
