// Тір `core` — те, що лишилося від однойменного пакета після К0: власні
// провайдери, хуки й компоненти, які ще не розселені по цільових тірах.
//
// 🔴 Фасадної ролі тут БІЛЬШЕ НЕМАЄ. Реекспорти чужого (pricing, discounts,
// shipping, `cn`, `Database`) знято разом із розчиненням пакета: споживач
// бере їх із джерела — `simplycms/domain/*`, `simplycms/contracts`,
// `simplycms/ui/utils`, `simplycms/supabase`. Повне розселення власних
// модулів по тірах — свідомо поза К0.

// ---- Providers ----
export { CMSProvider } from './providers/CMSProvider';

// ---- Hooks ----
export { AuthProvider, useAuth } from './hooks/useAuth';
export { useCart } from './hooks/useCart';
export type { CartItem as CartItemType } from './hooks/useCart';
export { useToast, toast } from './hooks/use-toast';
export { useBanners } from './hooks/useBanners';
export type { Banner, BannerButton } from './hooks/useBanners';
export {
  useDiscountGroups,
  useDiscountContext,
  applyDiscount,
} from './hooks/useDiscountedPrice';
export { usePriceType } from './hooks/usePriceType';
export {
  useProductReviews,
  useProductRatings,
} from './hooks/useProductReviews';
export type { ProductReview } from './hooks/useProductReviews';
export {
  calculateProductAvailability,
  fetchModificationPropertyValues,
  fetchModificationStockData,
  enrichProductsWithAvailability,
} from './hooks/useProductsWithStock';
export type { StockData } from './hooks/useProductsWithStock';
export {
  useStock,
  usePickupPointsCount,
  usePickupPoints,
  isProductAvailable,
  getStockStatusLabel,
  getStockStatusColor,
} from './hooks/useStock';
export type { StockStatus, StockByPoint, StockInfo } from './hooks/useStock';

// ---- Lib ----
export {
  signUp,
  signIn,
  signOut,
  resetPassword,
  updatePassword,
  getSession,
  getUser,
} from './lib/supabase';
export { findShippingZone } from './lib/shipping/findZone';

// ---- Catalog Components ----
export { ActiveFilters } from './components/catalog/ActiveFilters';
export type { ActiveFilter } from './components/catalog/ActiveFilters';
export { FilterSidebar } from './components/catalog/FilterSidebar';
export { ModificationSelector } from './components/catalog/ModificationSelector';
export type { ModificationStockInfo } from './components/catalog/ModificationSelector';
export { ProductCard } from './components/catalog/ProductCard';
export { ProductCharacteristics } from './components/catalog/ProductCharacteristics';
export { ProductGallery } from './components/catalog/ProductGallery';
export { StockDisplay, StockBadge } from './components/catalog/StockDisplay';

// ---- Cart Components ----
export { CartDrawer } from './components/cart/CartDrawer';
export { CartItem } from './components/cart/CartItem';

// ---- Checkout Components ----
export { CheckoutAuthBlock } from './components/checkout/CheckoutAuthBlock';
export { CheckoutContactForm } from './components/checkout/CheckoutContactForm';
export { CheckoutDeliveryForm } from './components/checkout/CheckoutDeliveryForm';
export { CheckoutOrderSummary } from './components/checkout/CheckoutOrderSummary';
export { CheckoutPaymentForm } from './components/checkout/CheckoutPaymentForm';
export { CheckoutRecipientForm } from './components/checkout/CheckoutRecipientForm';

// ---- Reviews Components ----
export { ProductReviews } from './components/reviews/ProductReviews';
export { StarRating } from './components/reviews/StarRating';

// ---- Profile Components ----
export { AddressesList } from './components/profile/AddressesList';
export { AvatarUpload } from './components/profile/AvatarUpload';
export { RecipientsList } from './components/profile/RecipientsList';
