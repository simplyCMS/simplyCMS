// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { TestI18nProvider } from '../../../../../test-harness/i18n';
import {
  AggregateVersionContext,
  useAggregateVersionStore,
} from '../useAggregateCommand';
import { useTranslatableTexts } from '../useTranslatableTexts';

afterEach(cleanup);

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('sonner', () => ({
  toast: { error: toastError, success: vi.fn() },
}));

const FIELDS = ['name'] as const;
const LANGS = [
  { code: 'uk', name: 'Українська', isDefault: true },
  { code: 'en', name: 'English', isDefault: false },
];
const agg = (version: number, uk: string) => ({
  version,
  texts: {
    uk: { name: uk, status: 'current', fieldStatus: { name: 'current' } },
  },
});

/** Діалог/сторінка однаково: хук живе під провайдером версії агрегата. */
function setup(
  refetch: () => Promise<ReturnType<typeof agg> | undefined>,
  required: readonly (typeof FIELDS)[number][] = ['name'],
) {
  let store!: ReturnType<typeof useAggregateVersionStore>;
  function Wrapper({ children }: { children: ReactNode }) {
    store = useAggregateVersionStore(1);
    return (
      <TestI18nProvider>
        <AggregateVersionContext.Provider value={store}>
          {children}
        </AggregateVersionContext.Provider>
      </TestI18nProvider>
    );
  }
  const hook = renderHook(
    () => {
      const r = useTranslatableTexts({
        fields: FIELDS,
        primary: 'uk',
        languages: LANGS,
        aggregate: agg(1, 'A'),
        required,
        refetch,
        // Навмисно НЕ товарний ключ: регрес до хардкоду ключа в хуку мусить впасти в його власному тесті.
        loadFailedKey: 'admin.orders.statuses.loadFailed',
      });
      // formState — проксі з підпискою: читаємо помилки в рендері, як компонент форми.
      void r.form.formState.errors;
      return r;
    },
    { wrapper: Wrapper },
  );
  return { ...hook, store: () => store };
}

describe('useTranslatableTexts', () => {
  it('форма з агрегата: мова без перекладу порожня', () => {
    const { result } = setup(async () => agg(1, 'A'));
    expect(result.current.form.getValues('texts')).toEqual({
      uk: { name: 'A' },
      en: { name: '' },
    });
  });

  it('свідоме перечитування: форма й версія беруть БД, конфлікт закрито', async () => {
    const { result, store } = setup(async () => agg(5, 'З БД'));
    act(() => result.current.setConflict(true));
    await act(() => result.current.reload());
    expect(result.current.form.getValues('texts.uk.name')).toBe('З БД');
    expect(store().get()).toBe(5);
    expect(result.current.conflict).toBe(false);
  });

  it('після власного збереження: правка під час запиту лишається зміною, версія не чіпається', async () => {
    const { result, store } = setup(async () => agg(5, 'З БД'));
    const sent = { uk: { name: 'A' }, en: { name: '' } };
    act(() => result.current.form.setValue('texts.uk.name', 'Мій'));
    await act(() => result.current.reload(sent));
    expect(result.current.form.getValues('texts.uk.name')).toBe('Мій');
    expect(result.current.form.formState.dirtyFields.texts?.uk?.name).toBe(
      true,
    );
    expect(store().get()).toBe(1);
  });

  it('помилка texts.en.name: вкладка позначена й активна', () => {
    const { result } = setup(async () => agg(1, 'A'));
    act(() => result.current.noteTextError('texts.en.name'));
    expect(result.current.errorLocales.has('en')).toBe(true);
    expect(result.current.active).toBe('en');
  });

  it('перечитування, що не вдалось (undefined): тост, форма й статуси без змін', async () => {
    toastError.mockClear();
    const { result } = setup(async () => undefined);
    act(() => result.current.form.setValue('texts.uk.name', 'Мій'));
    await act(() => result.current.reload());
    expect(toastError).toHaveBeenCalledWith('Не вдалося завантажити статус');
    expect(result.current.form.getValues('texts.uk.name')).toBe('Мій');
  });

  it('статуси беруться з останнього застосованого агрегата', async () => {
    const fresh = agg(2, 'A');
    fresh.texts.uk.fieldStatus = { name: 'outdated' };
    const { result } = setup(async () => fresh);
    await act(() => result.current.reload());
    expect(result.current.statuses.uk!.fieldStatus.name).toBe('outdated');
  });

  it('required: [] — порожня назва основної мови проходить', async () => {
    const { result } = setup(async () => agg(1, 'A'), []);
    act(() => result.current.form.setValue('texts.uk.name', ''));
    expect(await result.current.form.trigger()).toBe(true);
  });

  it("required: ['name'] — порожня назва основної мови падає на texts.uk.name", async () => {
    const { result } = setup(async () => agg(1, 'A'), ['name']);
    act(() => result.current.form.setValue('texts.uk.name', ''));
    let ok = true;
    await act(async () => {
      ok = await result.current.form.trigger();
    });
    expect(ok).toBe(false);
    const { form } = result.current;
    expect(form.formState.errors.texts?.uk?.name?.message).toBe(
      'validation.fieldRequired',
    );
  });
});
