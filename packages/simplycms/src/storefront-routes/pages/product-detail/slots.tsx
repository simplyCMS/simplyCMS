// Слоти картки товару, прибінджені до контейнера (контракт тем v3, Фаза 3).
//
// Компоненти модуль-рівневі й сталі — свіжі значення беруть із контексту
// прив'язок (`slot-context.tsx`), тож тема, розставляючи їх у власному
// лейауті, не може ані зламати воронку купівлі, ані спричинити перемонтаж.

import type {
  ProductDetailSlots,
  SlotAppearanceProps,
} from 'simplycms/contracts/views';
import { ProductAddToCart } from '../../views/slots/ProductAddToCart';
import {
  ProductStockAvailability,
  ProductReviewsBlock,
} from '../../views/slots/ProductContentSlots';
import { ProductModificationPicker } from '../../views/slots/ProductModificationPicker';
import {
  ProductPluginAfter,
  ProductPluginBadges,
  ProductPluginBefore,
} from '../../views/slots/ProductPluginSlots';
import { ProductPriceBlock } from '../../views/slots/ProductPriceBlock';
import { ProductStockBadge } from '../../views/slots/ProductStockBadge';
import { useProductDetailBindings } from './slot-context';

function PluginBefore({ className }: SlotAppearanceProps) {
  const { pluginContext } = useProductDetailBindings();
  return <ProductPluginBefore className={className} context={pluginContext} />;
}

function PluginBadges({ className }: SlotAppearanceProps) {
  const { pluginContext } = useProductDetailBindings();
  return <ProductPluginBadges className={className} context={pluginContext} />;
}

function PluginAfter({ className }: SlotAppearanceProps) {
  const { pluginAfterContext } = useProductDetailBindings();
  return (
    <ProductPluginAfter className={className} context={pluginAfterContext} />
  );
}

function StockBadge({ className }: SlotAppearanceProps) {
  const { stockStatus } = useProductDetailBindings();
  return <ProductStockBadge className={className} stockStatus={stockStatus} />;
}

function PriceBlock({ className }: SlotAppearanceProps) {
  const { price, oldPrice } = useProductDetailBindings();
  return (
    <ProductPriceBlock
      className={className}
      price={price}
      oldPrice={oldPrice}
    />
  );
}

function ModificationSelector({ className }: SlotAppearanceProps) {
  const bindings = useProductDetailBindings();
  return (
    <ProductModificationPicker
      className={className}
      modifications={bindings.modifications}
      selectedId={bindings.selectedModId}
      onSelect={bindings.onSelectModification}
      prices={bindings.modificationPrices}
      stockByModification={bindings.stockByModification}
    />
  );
}

function AddToCart({ className }: SlotAppearanceProps) {
  const { cartItem, isInStock } = useProductDetailBindings();
  return (
    <ProductAddToCart
      className={className}
      item={cartItem}
      inStock={isInStock}
    />
  );
}

function StockAvailability({ className }: SlotAppearanceProps) {
  const { availabilityProductId, availabilityModificationId } =
    useProductDetailBindings();
  return (
    <ProductStockAvailability
      className={className}
      productId={availabilityProductId}
      modificationId={availabilityModificationId}
    />
  );
}

function Reviews({ className }: SlotAppearanceProps) {
  const { productId } = useProductDetailBindings();
  return <ProductReviewsBlock className={className} productId={productId} />;
}

/** Сталий набір реквізитів картки — саме він їде у view-model. */
export const productDetailSlots: ProductDetailSlots = {
  PluginBefore,
  StockBadge,
  PluginBadges,
  PriceBlock,
  ModificationSelector,
  AddToCart,
  StockAvailability,
  Reviews,
  PluginAfter,
};
