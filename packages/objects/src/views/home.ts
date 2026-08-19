// View-model головної сторінки (контракт тем v3, спека §4).
// Склад полів знято з фактичного JSX `pages/Home.tsx` — YAGNI, без запасу.

import type { Banner } from '../objects/banner';
import type { ProductCardViewModel } from './common';
import type { SlotAppearanceProps, SlotComponent } from './slots';

/** Hero головної: банери, які тема віддає власному компоненту або ядру. */
export interface HomeHeroViewModel {
  banners: Banner[];
}

/** Товарна добірка головної (популярні, новинки). */
export interface HomeCollectionViewModel {
  products: ProductCardViewModel[];
}

/**
 * Коренева категорія каталогу — заголовок секції головної.
 *
 * Р2/YAGNI: канонічний `HomeView` читає лише `id` (ключ ітерації й пропс
 * слота `SectionCarousel`) — назву й посилання малює сам слот зі свого
 * контексту (`HomeBindings`), не з vm. `name`/`slug` тут навмисно немає.
 */
export interface HomeSectionSummary {
  id: string;
}

/** Перелік кореневих категорій, для яких ядро рендерить карусель товарів. */
export interface HomeSectionsViewModel {
  items: HomeSectionSummary[];
}

/**
 * Пропси слота секційної каруселі: товари секції тягне сам слот (запит із
 * SSR-даними), тому view передає лише ідентифікатор секції.
 */
export interface HomeSectionSlotProps extends SlotAppearanceProps {
  sectionId: string;
}

export interface HomeSlots {
  /** Карусель товарів однієї кореневої категорії; порожню не рендерить. */
  SectionCarousel: SlotComponent<HomeSectionSlotProps>;
}

export interface HomeViewModel {
  hero: HomeHeroViewModel;
  featured: HomeCollectionViewModel;
  newArrivals: HomeCollectionViewModel;
  sections: HomeSectionsViewModel;
  slots: HomeSlots;
}
