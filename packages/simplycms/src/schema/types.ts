// Типи рядків БД, виведені з Drizzle-схеми — джерело правди для НОВОГО
// серверного коду (serverFn-шар К2/К3, репозиторії `data-pg`).
//
// 🔴 Це ЧАСТИНА рішення B12, а не його завершення. Baseline ядра
// (`src/supabase/database.ts`) СЬОГОДНІ ЖИВИЙ і заморожений до треку К3
// (host-генерат `supabase/types.ts` разом із генератором знесено): доки в коді
// лишається `supabase-js`, її споживачі типізуються саме нею. Тому не
// «прибирай дублювання» передчасно — обидва джерела мають співіснувати
// рівно доти, доки не зникне останній `useSupabaseClient()`.
//
// Правило вибору для нового коду: усе, що ходить у БД через `simplycms/db`
// (тобто через `withActor`), типізується звідси; усе, що ще ходить через
// Supabase-клієнт, — старими типами.

import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import type { media } from './media';
import type { accounts, sessions, users, verifications } from './auth';
import type {
  banners,
  categoryRules,
  comparisons,
  discountConditions,
  discountGroups,
  discountTargets,
  discounts,
  languages,
  modificationPropertyValues,
  orderItems,
  orderStatuses,
  orders,
  pickupPoints,
  pluginEvents,
  plugins,
  priceTypes,
  productModifications,
  productPrices,
  productPropertyValues,
  productReviews,
  products,
  profiles,
  propertyOptions,
  sectionProperties,
  sectionPropertyAssignments,
  sections,
  serviceRequests,
  services,
  shippingMethods,
  shippingRates,
  shippingZones,
  stockByPickupPoint,
  systemSettings,
  themes,
  userAddresses,
  userCategories,
  userCategoryHistory,
  userRecipients,
  userRoles,
  wishlists,
} from './schema';

// ── Auth (Better Auth, канонічні таблиці в `public` — рішення B3′) ─────────

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;
export type Account = InferSelectModel<typeof accounts>;
export type NewAccount = InferInsertModel<typeof accounts>;
export type Verification = InferSelectModel<typeof verifications>;
export type NewVerification = InferInsertModel<typeof verifications>;

// ── Профіль і права ───────────────────────────────────────────────────────

export type Profile = InferSelectModel<typeof profiles>;
export type NewProfile = InferInsertModel<typeof profiles>;
export type UserRole = InferSelectModel<typeof userRoles>;
export type NewUserRole = InferInsertModel<typeof userRoles>;
export type UserCategory = InferSelectModel<typeof userCategories>;
export type NewUserCategory = InferInsertModel<typeof userCategories>;
export type UserCategoryHistory = InferSelectModel<typeof userCategoryHistory>;
export type NewUserCategoryHistory = InferInsertModel<
  typeof userCategoryHistory
>;
export type CategoryRule = InferSelectModel<typeof categoryRules>;
export type NewCategoryRule = InferInsertModel<typeof categoryRules>;
export type UserAddress = InferSelectModel<typeof userAddresses>;
export type NewUserAddress = InferInsertModel<typeof userAddresses>;
export type UserRecipient = InferSelectModel<typeof userRecipients>;
export type NewUserRecipient = InferInsertModel<typeof userRecipients>;

// ── Каталог ───────────────────────────────────────────────────────────────

export type Product = InferSelectModel<typeof products>;
export type NewProduct = InferInsertModel<typeof products>;
export type ProductModification = InferSelectModel<typeof productModifications>;
export type NewProductModification = InferInsertModel<
  typeof productModifications
>;
export type ProductPrice = InferSelectModel<typeof productPrices>;
export type NewProductPrice = InferInsertModel<typeof productPrices>;
export type ProductPropertyValue = InferSelectModel<
  typeof productPropertyValues
>;
export type ModificationPropertyValue = InferSelectModel<
  typeof modificationPropertyValues
>;
export type ProductReview = InferSelectModel<typeof productReviews>;
export type NewProductReview = InferInsertModel<typeof productReviews>;
export type Section = InferSelectModel<typeof sections>;
export type NewSection = InferInsertModel<typeof sections>;
export type SectionProperty = InferSelectModel<typeof sectionProperties>;
export type SectionPropertyAssignment = InferSelectModel<
  typeof sectionPropertyAssignments
>;
export type PropertyOption = InferSelectModel<typeof propertyOptions>;
export type PriceType = InferSelectModel<typeof priceTypes>;

// ── Замовлення й воронка ──────────────────────────────────────────────────

export type Order = InferSelectModel<typeof orders>;
export type NewOrder = InferInsertModel<typeof orders>;
export type OrderItem = InferSelectModel<typeof orderItems>;
export type NewOrderItem = InferInsertModel<typeof orderItems>;
export type OrderStatus = InferSelectModel<typeof orderStatuses>;
export type Wishlist = InferSelectModel<typeof wishlists>;
export type NewWishlist = InferInsertModel<typeof wishlists>;
export type Comparison = InferSelectModel<typeof comparisons>;
export type NewComparison = InferInsertModel<typeof comparisons>;

// ── Знижки ────────────────────────────────────────────────────────────────

export type Discount = InferSelectModel<typeof discounts>;
export type NewDiscount = InferInsertModel<typeof discounts>;
export type DiscountGroup = InferSelectModel<typeof discountGroups>;
export type DiscountCondition = InferSelectModel<typeof discountConditions>;
export type DiscountTarget = InferSelectModel<typeof discountTargets>;

// ── Доставка й склад ──────────────────────────────────────────────────────

export type ShippingMethod = InferSelectModel<typeof shippingMethods>;
export type ShippingZone = InferSelectModel<typeof shippingZones>;
export type ShippingRate = InferSelectModel<typeof shippingRates>;
export type PickupPoint = InferSelectModel<typeof pickupPoints>;
export type StockByPickupPoint = InferSelectModel<typeof stockByPickupPoint>;

// ── Медіа (метадані порту К4) ─────────────────────────────────────────────

export type Media = InferSelectModel<typeof media>;
export type NewMedia = InferInsertModel<typeof media>;

// ── Інфраструктура магазину ───────────────────────────────────────────────

export type Theme = InferSelectModel<typeof themes>;
export type NewTheme = InferInsertModel<typeof themes>;
export type Plugin = InferSelectModel<typeof plugins>;
export type PluginEvent = InferSelectModel<typeof pluginEvents>;
export type SystemSetting = InferSelectModel<typeof systemSettings>;
export type Language = InferSelectModel<typeof languages>;
export type Banner = InferSelectModel<typeof banners>;
export type NewBanner = InferInsertModel<typeof banners>;
export type Service = InferSelectModel<typeof services>;
export type ServiceRequest = InferSelectModel<typeof serviceRequests>;
export type NewServiceRequest = InferInsertModel<typeof serviceRequests>;
