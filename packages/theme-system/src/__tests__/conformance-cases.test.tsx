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

  it('кожен кейс несе обидва стани — повний і крайній', () => {
    for (const item of buildConformanceCases(allViews)) {
      for (const state of CONFORMANCE_STATES) {
        expect(item.states[state], `${item.name}/${state}`).toBeTruthy();
      }
    }
  });

  it('тема без жодного заявленого view — жодного кейса', () => {
    expect(buildConformanceCases({})).toEqual([]);
  });
});
