// @vitest-environment jsdom
/**
 * Юніти спільних частин вкладок мов: бейдж статусу, вкладки, `useAggregateCommand`
 * (версія з відповіді, 412, один запит) і `PathField`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { I18nProvider } from 'simplycms/i18n';
import { ResizeObserverStub } from '../../products/edit/__tests__/test-engine-stub';
import { LanguageTabs } from '../LanguageTabs';
import { PathField } from '../PathField';
import { TranslationStatusBadge } from '../TranslationStatusBadge';
import {
  AggregateVersionContext,
  useAggregateCommand,
  useAggregateVersionStore,
} from '../useAggregateCommand';

vi.stubGlobal('ResizeObserver', ResizeObserverStub);
const mocks = vi.hoisted(() => ({ setProductPath: vi.fn() }));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(mocks),
);
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: toastError, info: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const i18n = ({ children }: { children: ReactNode }) => (
  <I18nProvider locale="uk">{children}</I18nProvider>
);

describe('TranslationStatusBadge', () => {
  it('актуальний мовчить, застарілий і відсутній підписані', () => {
    const { rerender } = render(<TranslationStatusBadge status="current" />, {
      wrapper: i18n,
    });
    expect(screen.queryByText('Актуальний')).toBeNull();
    rerender(<TranslationStatusBadge status="outdated" />);
    expect(screen.getByText('Застарілий')).toBeTruthy();
    rerender(<TranslationStatusBadge status="missing" />);
    expect(screen.getByText('Немає перекладу')).toBeTruthy();
    rerender(<TranslationStatusBadge status="current" showCurrent />);
    expect(screen.getByText('Актуальний')).toBeTruthy();
  });
});

describe('LanguageTabs', () => {
  const langs = [
    { code: 'uk', name: 'Українська', isDefault: true },
    { code: 'en', name: 'English', isDefault: false },
  ];
  it('основна мова позначена «джерело», решта — статусом; помилка мови позначена', async () => {
    const onChange = vi.fn();
    render(
      <LanguageTabs
        languages={langs}
        active="uk"
        onChange={onChange}
        statusOf={() => 'outdated'}
        errorLocales={new Set(['en'])}
      />,
      { wrapper: i18n },
    );
    expect(screen.getByText('джерело')).toBeTruthy();
    expect(screen.getByText('Застарілий')).toBeTruthy();
    expect(screen.getAllByRole('img', { name: 'Є помилки' })).toHaveLength(1);
    await userEvent.setup().click(screen.getByRole('tab', { name: /English/ }));
    expect(onChange).toHaveBeenCalledWith('en');
  });
});

function withStore(initial: number) {
  return function Wrapper({ children }: { children: ReactNode }) {
    const store = useAggregateVersionStore(initial);
    return (
      <AggregateVersionContext.Provider value={store}>
        {children}
      </AggregateVersionContext.Provider>
    );
  };
}

describe('useAggregateCommand', () => {
  it('один запит із expectedVersion зі стору; нова версія береться з відповіді', async () => {
    const fn = vi.fn(async () => ({ version: 8 }));
    const { result } = renderHook(
      () => useAggregateCommand(fn as never, { onConflict: vi.fn() }),
      { wrapper: withStore(5) },
    );
    await act(() => result.current.run({ id: 'x' } as never));
    await act(() => result.current.run({ id: 'x' } as never));
    expect(fn).toHaveBeenNthCalledWith(1, {
      data: { id: 'x', expectedVersion: 5 },
    });
    expect(fn).toHaveBeenNthCalledWith(2, {
      data: { id: 'x', expectedVersion: 8 },
    });
  });

  it('412 -> onConflict(currentVersion) і null; версія стору не змінюється', async () => {
    const onConflict = vi.fn();
    const fn = vi.fn(async () => {
      throw Object.assign(new Error('v'), {
        name: 'VersionMismatchError',
        currentVersion: 9,
      });
    });
    const { result } = renderHook(
      () => useAggregateCommand(fn as never, { onConflict }),
      { wrapper: withStore(5) },
    );
    let out: unknown;
    await act(async () => {
      out = await result.current.run({ id: 'x' } as never);
    });
    expect(out).toBeNull();
    expect(onConflict).toHaveBeenCalledWith(9);
    await act(async () => {
      await result.current.run({ id: 'x' } as never);
    });
    expect(fn).toHaveBeenLastCalledWith({
      data: { id: 'x', expectedVersion: 5 },
    });
  });

  it('інша помилка летить викликачу', async () => {
    const fn = vi.fn(async () => {
      throw new Error('boom');
    });
    const { result } = renderHook(
      () => useAggregateCommand(fn as never, { onConflict: vi.fn() }),
      { wrapper: withStore(1) },
    );
    await expect(result.current.run({} as never)).rejects.toThrow('boom');
  });
});

describe('PathField', () => {
  const field = (onSaved = vi.fn()) =>
    function Wrapper() {
      const store = useAggregateVersionStore(3);
      return (
        <AggregateVersionContext.Provider value={store}>
          <PathField
            productId="p"
            locale="en"
            languageName="English"
            path="cable"
            onConflict={vi.fn()}
            onSaved={onSaved}
          />
        </AggregateVersionContext.Provider>
      );
    };

  it('кнопка вимкнена, доки адресу не змінено; збереження шле setPath і кличе onSaved', async () => {
    mocks.setProductPath.mockResolvedValue({ version: 4 });
    const onSaved = vi.fn();
    const Field = field(onSaved);
    render(<Field />, { wrapper: i18n });
    const button = screen.getByRole('button', { name: 'Зберегти адресу' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText(/Адреса/));
    await user.type(screen.getByLabelText(/Адреса/), 'wire');
    await user.click(button);
    expect(mocks.setProductPath).toHaveBeenCalledWith({
      data: { id: 'p', locale: 'en', path: 'wire', expectedVersion: 3 },
    });
    expect(onSaved).toHaveBeenCalledWith('wire');
  });

  it('конфлікт адреси (path_taken) показує тост, onSaved не кличеться', async () => {
    mocks.setProductPath.mockRejectedValue(
      Object.assign(new Error('x'), {
        name: 'AdminConflictError',
        kind: 'unique',
        constraint: 'path_taken',
      }),
    );
    const onSaved = vi.fn();
    const Field = field(onSaved);
    render(<Field />, { wrapper: i18n });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Адреса/), '2');
    await user.click(screen.getByRole('button', { name: 'Зберегти адресу' }));
    expect(onSaved).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(
      'Такий URL (slug) уже зайнятий — змініть його',
    );
  });
});
