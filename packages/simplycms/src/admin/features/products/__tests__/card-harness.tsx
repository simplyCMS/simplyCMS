import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form';
import { I18nProvider } from 'simplycms/i18n';
import { EngineProvider } from 'simplycms/react-query';
import {
  TranslationContext,
  type LanguageInfo,
  type LocaleStatuses,
} from '../../translations/translation-context';
import {
  AggregateVersionContext,
  useAggregateVersionStore,
} from '../../translations/useAggregateCommand';
import {
  ProductCardContext,
  type ProductCardContextValue,
} from '../edit/product-card-context';
import { blankForm } from '../edit/product-aggregate';
import type { ProductFormValues } from '../edit/product-form-schema';
import { ENGINE } from '../edit/__tests__/test-engine-stub';

export const LANGS: readonly LanguageInfo[] = [
  { code: 'uk', name: 'Українська', isDefault: true },
  { code: 'en', name: 'English', isDefault: false },
];

export const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';

interface Options {
  readonly values?: Partial<ProductFormValues>;
  readonly statuses?: Record<string, LocaleStatuses>;
  readonly card?: Partial<ProductCardContextValue>;
  readonly active?: string;
  readonly version?: number;
  readonly onForm?: (form: UseFormReturn<ProductFormValues>) => void;
}

function Inner({ o, children }: { o: Options; children: ReactNode }) {
  const form = useForm<ProductFormValues>({
    defaultValues: {
      ...blankForm(LANGS.map((l) => l.code)),
      ...o.values,
    },
  });
  o.onForm?.(form);
  const store = useAggregateVersionStore(o.version ?? 1);
  const [active, setActive] = useState(o.active ?? 'uk');
  return (
    <AggregateVersionContext.Provider value={store}>
      <TranslationContext.Provider
        value={{
          languages: LANGS,
          primary: 'uk',
          active,
          setActive,
          statuses: o.statuses ?? {},
        }}
      >
        <ProductCardContext.Provider
          value={{
            productId: PRODUCT_ID,
            entityId: PRODUCT_ID,
            paths: {},
            persistedModificationIds: new Set(),
            modificationErrors: {},
            valueErrors: {},
            clearValueError: () => undefined,
            onConflict: () => undefined,
            ...o.card,
          }}
        >
          <FormProvider {...form}>{children}</FormProvider>
        </ProductCardContext.Provider>
      </TranslationContext.Provider>
    </AggregateVersionContext.Provider>
  );
}

/**
 * Обгортка тестів фрагментів картки: форма, мови (uk — джерело, en),
 * контексти картки й версії, i18n, react-query. Форма віддається через
 * `onForm`, щоб тест читав і міняв чернетку.
 */
export function CardHarness({
  children,
  ...o
}: Options & { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <EngineProvider value={ENGINE}>
        <I18nProvider locale="uk">
          <Inner o={o}>{children}</Inner>
        </I18nProvider>
      </EngineProvider>
    </QueryClientProvider>
  );
}

export const mod = (id: string, name: string, extra: object = {}) => ({
  id,
  sku: '',
  isDefault: false,
  sortOrder: 0,
  texts: { uk: name, en: '' },
  token: {},
  ...extra,
});
