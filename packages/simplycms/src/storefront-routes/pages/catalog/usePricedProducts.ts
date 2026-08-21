// Резолв цін вибірки каталогу під тип ціни покупця й знижки (Фаза 4).

import { useMemo } from 'react';
import { usePriceType } from 'simplycms/core/hooks/usePriceType';
import { resolvePrice, type PriceEntry } from 'simplycms/domain/pricing';
import {
  useDiscountGroups,
  useDiscountContext,
  applyDiscount,
} from 'simplycms/core/hooks/useDiscountedPrice';
import type { RawCatalogProduct } from './useCatalogProductsQuery';

/**
 * Ціна за замовчуванням береться з модифікації-дефолту (товар із
 * модифікаціями) або з самого товару. Знижка, якщо спрацювала, стає
 * поточною ціною, а вихідна показується як «стара».
 *
 * 🔴 Три хуки цінового контуру викликаються безумовно — інакше їхні запити
 * серіалізувалися б після вибірки товарів замість того, щоб іти паралельно.
 */
export function usePricedProducts(
  rawProducts: RawCatalogProduct[] | undefined,
) {
  const { priceTypeId, defaultPriceTypeId } = usePriceType();
  const { data: discountGroups = [] } = useDiscountGroups();
  const discountCtx = useDiscountContext();

  return useMemo(() => {
    if (!rawProducts) return undefined;

    return rawProducts.map((p) => {
      const prices = (p.product_prices ?? []) as PriceEntry[];
      const defaultMod =
        p.has_modifications && p.modifications?.[0] ? p.modifications[0] : null;
      const resolved = resolvePrice(
        prices,
        priceTypeId,
        defaultPriceTypeId,
        defaultMod?.id ?? null,
      );

      let finalPrice = resolved.price;
      let oldPrice = resolved.oldPrice;

      if (finalPrice !== null && discountGroups.length > 0) {
        const result = applyDiscount(finalPrice, discountGroups, {
          ...discountCtx,
          quantity: 1,
          // Вибірка каталогу рендериться поза кошиком — сума кошика нульова.
          cartTotal: 0,
          productId: p.id,
          modificationId: defaultMod?.id || null,
          // Розділ беремо з приєднаної гілки, а за її відсутності — з поля
          // рядка: обидві сторінки до спліту читали розділ по-своєму, значення
          // збігаються (гілка `sections` приєднана тим самим запитом).
          sectionId: p.section?.id ?? p.section_id ?? null,
        });
        if (result.totalDiscount > 0) {
          oldPrice = finalPrice;
          finalPrice = result.finalPrice;
        }
      }

      const stockStatus = p.has_modifications
        ? (defaultMod?.stock_status ?? 'in_stock')
        : (p.stock_status ?? 'in_stock');

      return {
        ...p,
        price: finalPrice,
        old_price: oldPrice,
        stock_status: stockStatus,
      };
    });
  }, [
    rawProducts,
    priceTypeId,
    defaultPriceTypeId,
    discountGroups,
    discountCtx,
  ]);
}

/** Товар вибірки з резолвленою ціною — саме він їде у фільтри й у сітку. */
export type PricedProduct = NonNullable<
  ReturnType<typeof usePricedProducts>
>[number];
