// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import type { ProductDetailViewModel } from 'simplycms/contracts/views';
import { FallbackText } from 'simplycms/ui/fallback-text';
import { assertThemeViewsConformance } from '../conformance';
import { GoodProductDetail, makeTheme } from './conformance-themes';

/**
 * І37 у conformance (фінальне рев'ю М1, B-I1): власний view картки товару мусить дати
 * fallback-фрагментам `lang` мови джерела. Парні кейси «має пройти / має впасти» — kit, що не
 * вміє червоніти, гірший за відсутній.
 */
function NameWithLang(vm: ProductDetailViewModel) {
  return (
    <>
      <h1>
        <FallbackText lang={vm.summary.name_lang}>
          {vm.summary.name}
        </FallbackText>
      </h1>
      <GoodProductDetail {...vm} />
    </>
  );
}

/** Дефект: назва з основної мови без `lang` — скрінрідер читає її вимовою мови сторінки. */
function NameWithoutLang(vm: ProductDetailViewModel) {
  return (
    <>
      <h1>{vm.summary.name}</h1>
      <GoodProductDetail {...vm} />
    </>
  );
}

/** Дефект: `alt` фото з основної мови без `lang` на `img`. */
function AltWithoutLang(vm: ProductDetailViewModel) {
  const image = vm.gallery.images[0];
  return (
    <>
      {image && <img src={image.url} alt={image.alt} />}
      <GoodProductDetail {...vm} />
    </>
  );
}

describe('assertThemeViewsConformance — lang fallback-фрагментів (І37)', () => {
  it('назва з lang — зелено', async () => {
    await expect(
      assertThemeViewsConformance(makeTheme({ ProductDetail: NameWithLang })),
    ).resolves.toEqual(['ProductDetail']);
  });

  it('назва без lang — червоно, з назвою поля', async () => {
    await expect(
      assertThemeViewsConformance(
        makeTheme({ ProductDetail: NameWithoutLang }),
      ),
    ).rejects.toThrow(/summary\.name «Назва основною мовою»: lang=∅ → uk/);
  });

  it('alt фото без lang — червоно', async () => {
    await expect(
      assertThemeViewsConformance(makeTheme({ ProductDetail: AltWithoutLang })),
    ).rejects.toThrow(/gallery\.alt «Фото основною мовою»: lang=∅ → uk/);
  });
});
