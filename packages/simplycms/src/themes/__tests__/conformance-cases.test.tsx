import { describe, it, expect } from 'vitest';
import {
  buildConformanceCases,
  CONFORMANCE_STATES,
} from '../conformance/cases';
import { THEME_VIEW_KEYS } from '../validateThemeModule';
import { GoodCart, GoodProductDetail } from './conformance-themes';
import {
  GoodCatalog,
  GoodCatalogSection,
  GoodHome,
} from './conformance-themes-pages';

/**
 * Підлога conformance-kit-а: `buildConformanceCases` складено пʼятьма ЯВНИМИ
 * блоками (навмисно — див. коментар у `cases.tsx`), і ціна цього рішення в
 * тому, що ключ, для якого блока немає, тихо не перевіряється.
 *
 * 🔴 Саме на це тут і стоїть гард: `assertThemeViewsConformance` на порожньому
 * списку кейсів чесно проходить, тож без звірки з `THEME_VIEW_KEYS` випалий
 * блок не червонив би НІЧОГО — ні kit, ні лінт, ні typecheck. Прогін теми,
 * яка заявила всі пʼять сторінок, має дати рівно пʼять кейсів.
 */
const allViews = {
  Home: GoodHome,
  Catalog: GoodCatalog,
  CatalogSection: GoodCatalogSection,
  ProductDetail: GoodProductDetail,
  Cart: GoodCart,
};

describe('buildConformanceCases', () => {
  it('тема з усіма views дає кейс на КОЖЕН ключ контракту v3', () => {
    const names = buildConformanceCases(allViews).map((item) => item.name);

    expect([...names].sort()).toEqual([...THEME_VIEW_KEYS].sort());
  });

  it('кожен кейс несе РІВНО обидва стани — повний і крайній', () => {
    // 🔴 Асерт саме на СКЛАД ключів, а не на truthy-значення: `states`
    // типізовано `Record<ConformanceState, ReactElement>`, а JSX-елемент —
    // завжди truthy-обʼєкт, тож перевірка `toBeTruthy()` не здатна впасти на
    // жодній типо-коректній реалізації (пропущений стан ловить typecheck, а
    // не тест). Склад ключів червоніє і на неповному, і на зайвому наборі.
    const cases = buildConformanceCases(allViews);
    expect(cases.length).toBeGreaterThan(0);

    for (const item of cases) {
      expect(Object.keys(item.states).sort(), item.name).toEqual(
        [...CONFORMANCE_STATES].sort(),
      );
    }
  });

  it('тема без жодного заявленого view — жодного кейса', () => {
    expect(buildConformanceCases({})).toEqual([]);
  });
});
