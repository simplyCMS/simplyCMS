import type { ReactNode } from 'react';
import type { EngineContext } from '@simplycms/objects';
import { EngineProvider } from '@simplycms/react-query';

/**
 * Мінімальний EngineContext для рендер-тестів сторінок.
 *
 * 🔴 Навіщо він зʼявився. Форматування ціни перестало бути локальною копією
 * `Intl.NumberFormat` у кожному компоненті й пішло через `useFormatPrice()`,
 * який бере локаль і валюту з `useEngine().config`. Це навмисно: 14 копій
 * ігнорували `simplycms.config.ts` і брали символ валюти з CLDR рушія, через
 * що SSR давав «₴», а браузер «грн» (гідраційний мисматч). Ціна рішення —
 * будь-який тест, що рендерить сторінку з ціною, тепер зобовʼязаний дати
 * EngineContext, як це робить прод (`ClientEngineProvider` у `__root.tsx`).
 *
 * Заповнено лише `config`: шлях рендеру, який перевіряють ці тести, інших
 * портів не торкається, а повний стаб шести репозиторіїв був би вигадкою, що
 * старіє швидше за самі порти. Якщо тест почне падати на відсутньому порті —
 * це сигнал, що покриття розширилось, і порт треба застубати свідомо, а не
 * заповнювати їх усі наперед.
 */
const engine = {
  config: {
    locale: 'uk-UA',
    currency: 'UAH',
    siteUrl: 'https://example.test',
    seo: {
      defaultTitle: 'Test store',
      titleTemplate: '%s',
      defaultDescription: '',
    },
  },
} as unknown as EngineContext;

export function TestEngineProvider({ children }: { children: ReactNode }) {
  return <EngineProvider value={engine}>{children}</EngineProvider>;
}
