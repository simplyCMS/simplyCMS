// Блок ціни сторінки товару на справжньому `useProductPricing` — без
// контейнера з галереєю, відгуками й залишками, яких ціна не потребує.

import type { ProductDetailProduct } from '../../product-detail/types';
import { useProductPricing } from '../../product-detail/useProductPricing';
import { ProductPriceBlock } from '../../../views/slots/ProductPriceBlock';

export function ProductPrice({ product }: { product: ProductDetailProduct }) {
  const { current } = useProductPricing({
    product,
    section: { id: 's1', slug: 'panels', name: 'Панелі' },
    hasModifications: false,
    modifications: [],
    selectedMod: undefined,
  });
  return (
    <ProductPriceBlock
      price={current?.price}
      oldPrice={current?.oldPrice}
      hints={current?.hints}
    />
  );
}
