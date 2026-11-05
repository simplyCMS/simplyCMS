// Підміна `simplycms/runtime/content-locale` для рендер-тестів без роутера: справжній хук читає
// `location.publicHref` з роутера, якого юніт-тест компонента не піднімає. Підключення в тесті:
//   vi.mock('simplycms/runtime/content-locale', () => import('<шлях>/test-harness/content-locale'));
import { createContext, useContext, type ReactNode } from 'react';
import type { ContentLocale } from 'simplycms/contracts';
import { cl } from './locale';

const ContentLocaleContext = createContext<ContentLocale>(cl('uk'));

/** Мова контенту сторінки в тесті (за замовчуванням `uk`). */
export function useContentLocale(): ContentLocale {
  return useContext(ContentLocaleContext);
}

export function TestContentLocale({
  locale,
  children,
}: {
  locale: string;
  children: ReactNode;
}) {
  return (
    <ContentLocaleContext.Provider value={cl(locale)}>
      {children}
    </ContentLocaleContext.Provider>
  );
}
