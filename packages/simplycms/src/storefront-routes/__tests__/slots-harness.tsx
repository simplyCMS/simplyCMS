import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from 'simplycms/i18n';
import { CartProvider } from 'simplycms/react-query';
import { TestEngineProvider } from './engine-stub';

/**
 * Обгортка рендер-тестів slot-компонентів (контракт тем v3, Фаза 2).
 *
 * Провайдери — рівно ті, що тримає прод (`__root.tsx`): i18n (слоти ходять
 * по рядки через `useT`), EngineContext (форматування ціни) і кошик
 * (`CartProvider` — справжній, на localStorage: реквізити купівлі
 * перевіряються наскрізь, а не проти мока).
 */
export function SlotHarness({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return (
    <QueryClientProvider client={client}>
      <I18nProvider locale="uk">
        <TestEngineProvider>
          <CartProvider>{children}</CartProvider>
        </TestEngineProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

/** Пошук реквізиту за маркером — тим самим, що шукає conformance-гейт. */
export function requisite(
  container: HTMLElement,
  name: string,
): HTMLElement | null {
  return container.querySelector(`[data-simplycms-requisite="${name}"]`);
}
