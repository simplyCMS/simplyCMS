// `@simplycms/objects/views/fixtures` — фікстурні view-model-и пʼяти
// канонічних сторінок (Р6).
//
// 🔴 Тека називається `fixtures`, а не `__fixtures__`: це не тест-онлі
// артефакт, а частина ПУБЛІЧНОГО контракту — на цих даних conformance-kit
// (`@simplycms/themes`) рендерить заявлені темою views без БД, і автор
// сторонньої теми запускає той самий kit із опублікованих пакетів.
//
// Фікстури — ДАНІ без слотів (`ViewModelData<T>`): слоти підставляє
// споживач (канонічний container у проді, conformance-kit у тестах).
// Стани по кожній сторінці: `full` — повний, `edge` — крайній.

export { homeViewModelFixtures } from './home';
export {
  catalogViewModelFixtures,
  catalogSectionViewModelFixtures,
} from './catalog';
export { productDetailViewModelFixtures } from './product-detail';
export { cartViewModelFixtures } from './cart';

import { homeViewModelFixtures } from './home';
import {
  catalogViewModelFixtures,
  catalogSectionViewModelFixtures,
} from './catalog';
import { productDetailViewModelFixtures } from './product-detail';
import { cartViewModelFixtures } from './cart';

/**
 * Агрегат за ключами `ThemeViews` — conformance-kit ітерує саме його,
 * тому новий view без фікстури тут одразу видно.
 */
export const viewModelFixtures = {
  Home: homeViewModelFixtures,
  Catalog: catalogViewModelFixtures,
  CatalogSection: catalogSectionViewModelFixtures,
  ProductDetail: productDetailViewModelFixtures,
  Cart: cartViewModelFixtures,
} as const;
