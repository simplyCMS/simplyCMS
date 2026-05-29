// ---- Providers ----
export { CMSProvider } from "./providers/CMSProvider";

// ---- Hooks ----
export { AuthProvider, useAuth } from "./hooks/useAuth";
export { useCart } from "./hooks/useCart";
export type { CartItem as CartItemType } from "./hooks/useCart";
export { useToast, toast } from "./hooks/use-toast";
export { useBanners } from "./hooks/useBanners";
export type { Banner, BannerButton } from "./hooks/useBanners";
export { useDiscountGroups, useDiscountContext, applyDiscount } from "./hooks/useDiscountedPrice";
export { usePriceType } from "./hooks/usePriceType";
export { useProductReviews, useProductRatings } from "./hooks/useProductReviews";
export type { ProductReview } from "./hooks/useProductReviews";
export {
  calculateProductAvailability,
  fetchModificationPropertyValues,
  fetchModificationStockData,
  enrichProductsWithAvailability,
} from "./hooks/useProductsWithStock";
export type { StockData } from "./hooks/useProductsWithStock";
export {
  useStock,
  usePickupPointsCount,
  usePickupPoints,
  isProductAvailable,
  getStockStatusLabel,
  getStockStatusColor,
} from "./hooks/useStock";
export type { StockStatus, StockByPoint, StockInfo } from "./hooks/useStock";

// ---- Lib ----
export { cn } from "./lib/utils";
export { resolvePrice } from "./lib/priceUtils";
export type { PriceEntry } from "./lib/priceUtils";
export { resolveDiscount } from "./lib/discountEngine";
export type {
  DiscountType,
  GroupOperator,
  TargetType,
  DiscountTarget,
  DiscountCondition,
  Discount,
  DiscountGroup,
  DiscountContext,
  AppliedDiscount,
  RejectedDiscount,
  DiscountResult,
} from "./lib/discountEngine";
export {
  signUp,
  signIn,
  signOut,
  resetPassword,
  updatePassword,
  getSession,
  getUser,
} from "./lib/supabase";

// ---- Shipping ----
export {
  calculateShippingCost,
  calculateShipping,
  formatShippingCost,
  findShippingZone,
} from "./lib/shipping";
export type {
  ShippingMethodType,
  ShippingCalculationType,
  ShippingMethod,
  ShippingZone,
  ShippingRate,
  PickupPoint,
  WorkingHours,
  Coordinates,
  ShippingCalculationContext,
  ShippingCalculationResult,
  ShippingFormData,
} from "./lib/shipping";

// ---- Types ----
export type { Database } from "./types";

// ---- Supabase Client (DI) ----
export { createClient, getSupabaseBrowserClient } from "./supabase/client";
export type { SupabaseClient } from "./supabase/client";
export { SupabaseProvider, useSupabaseClient } from "./supabase/SupabaseProvider";

// ---- Catalog Components ----
export { ActiveFilters } from "./components/catalog/ActiveFilters";
export type { ActiveFilter } from "./components/catalog/ActiveFilters";
export { CatalogLayout } from "./components/catalog/CatalogLayout";
export { FilterSidebar } from "./components/catalog/FilterSidebar";
export { ModificationSelector } from "./components/catalog/ModificationSelector";
export type { ModificationStockInfo } from "./components/catalog/ModificationSelector";
export { ProductCard } from "./components/catalog/ProductCard";
export { ProductCharacteristics } from "./components/catalog/ProductCharacteristics";
export { ProductGallery } from "./components/catalog/ProductGallery";
export { StockDisplay, StockBadge } from "./components/catalog/StockDisplay";

// ---- Cart Components ----
export { CartButton } from "./components/cart/CartButton";
export { CartDrawer } from "./components/cart/CartDrawer";
export { CartItem } from "./components/cart/CartItem";

// ---- Checkout Components ----
export { AddressCard } from "./components/checkout/AddressCard";
export { AddressSaveDialog } from "./components/checkout/AddressSaveDialog";
export { AddressSelectorPopup } from "./components/checkout/AddressSelectorPopup";
export { CheckoutAuthBlock } from "./components/checkout/CheckoutAuthBlock";
export { CheckoutContactForm } from "./components/checkout/CheckoutContactForm";
export { CheckoutDeliveryForm } from "./components/checkout/CheckoutDeliveryForm";
export { CheckoutOrderSummary } from "./components/checkout/CheckoutOrderSummary";
export { CheckoutPaymentForm } from "./components/checkout/CheckoutPaymentForm";
export { CheckoutRecipientForm } from "./components/checkout/CheckoutRecipientForm";
export { RecipientCard } from "./components/checkout/RecipientCard";
export { RecipientSaveDialog } from "./components/checkout/RecipientSaveDialog";
export { RecipientSelectorPopup } from "./components/checkout/RecipientSelectorPopup";

// ---- Reviews Components ----
export { ProductReviews } from "./components/reviews/ProductReviews";
export { ReviewCard } from "./components/reviews/ReviewCard";
export { ReviewForm } from "./components/reviews/ReviewForm";
export { ReviewRichTextEditor } from "./components/reviews/ReviewRichTextEditor";
export { StarRating } from "./components/reviews/StarRating";

// ---- Profile Components ----
export { AddressesList } from "./components/profile/AddressesList";
export { AvatarUpload } from "./components/profile/AvatarUpload";
export { ProfileLayout } from "./components/profile/ProfileLayout";
export { RecipientsList } from "./components/profile/RecipientsList";
