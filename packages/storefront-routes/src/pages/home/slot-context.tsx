// Прив'язки slot-компонента секційної каруселі (контракт тем v3, Фаза 5).

import { createContext, useContext, type ReactNode } from 'react';
import type { HomeProduct, HomeSection } from './types';

/** Дані однієї кореневої секції, потрібні каруселі: назва/slug + SSR-товари. */
export interface HomeSectionBinding {
  section: HomeSection;
  initialData?: HomeProduct[];
}

/**
 * Контрактний `HomeSectionSlotProps` несе лише `sectionId` (view-model
 * §4/§5: товари тягне сам слот), тому решту даних секції — обʼєкт `section`
 * і SSR-`initialData` — слот бере з цієї мапи за ключем `sectionId`.
 */
export interface HomeBindings {
  /** `sectionId → дані каруселі`. */
  sections: Record<string, HomeSectionBinding>;
}

const BindingsContext = createContext<HomeBindings | null>(null);

/**
 * 🔴 Прив'язки їдуть контекстом, а не замиканнями — той самий доказ, що й у
 * ProductDetail/Catalog (Ф3/Ф4): компонент слота модуль-рівневий і сталий,
 * інакше `react-hooks/static-components` і зайвий перемонтаж піддерев.
 */
export function HomeSlotBindings({
  value,
  children,
}: {
  value: HomeBindings;
  children: ReactNode;
}) {
  return (
    <BindingsContext.Provider value={value}>
      {children}
    </BindingsContext.Provider>
  );
}

export function useHomeBindings(): HomeBindings {
  const value = useContext(BindingsContext);
  if (!value) {
    throw new Error('Home slots must be rendered inside <HomeSlotBindings>');
  }
  return value;
}
