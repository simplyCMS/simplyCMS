import React from "react";
import { Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useTheme } from "@/lib/themes";

// Admin imports (not themed)
import { AdminLayout } from "@/components/admin/AdminLayout";
import Dashboard from "@/pages/admin/Dashboard";
import Sections from "@/pages/admin/Sections";
import SectionEdit from "@/pages/admin/SectionEdit";
import AdminProperties from "@/pages/admin/Properties";
import PropertyEdit from "@/pages/admin/PropertyEdit";
import PropertyOptionEdit from "@/pages/admin/PropertyOptionEdit";
import Products from "@/pages/admin/Products";
import ProductEdit from "@/pages/admin/ProductEdit";
import Orders from "@/pages/admin/Orders";
import OrderDetail from "@/pages/admin/OrderDetail";
import OrderStatuses from "@/pages/admin/OrderStatuses";
import Users from "@/pages/admin/Users";
import UserEdit from "@/pages/admin/UserEdit";
import UserCategories from "@/pages/admin/UserCategories";
import UserCategoryEdit from "@/pages/admin/UserCategoryEdit";
import UserCategoryRules from "@/pages/admin/UserCategoryRules";
import UserCategoryRuleEdit from "@/pages/admin/UserCategoryRuleEdit";
import Plugins from "@/pages/admin/Plugins";
import PluginSettings from "@/pages/admin/PluginSettings";
import PlaceholderPage from "@/pages/admin/PlaceholderPage";
import Shipping from "@/pages/admin/Shipping";
import ShippingMethods from "@/pages/admin/ShippingMethods";
import ShippingMethodEdit from "@/pages/admin/ShippingMethodEdit";
import ShippingZones from "@/pages/admin/ShippingZones";
import ShippingZoneEdit from "@/pages/admin/ShippingZoneEdit";
import PickupPoints from "@/pages/admin/PickupPoints";
import PickupPointEdit from "@/pages/admin/PickupPointEdit";
import Settings from "@/pages/admin/Settings";
import Themes from "@/pages/admin/Themes";
import ThemeSettings from "@/pages/admin/ThemeSettings";
import PriceTypes from "@/pages/admin/PriceTypes";
import PriceTypeEdit from "@/pages/admin/PriceTypeEdit";
import Discounts from "@/pages/admin/Discounts";
import DiscountGroupEdit from "@/pages/admin/DiscountGroupEdit";
import DiscountEdit from "@/pages/admin/DiscountEdit";
import PriceValidator from "@/pages/admin/PriceValidator";
import Banners from "@/pages/admin/Banners";
import BannerEdit from "@/pages/admin/BannerEdit";
import AdminReviews from "@/pages/admin/Reviews";
import AdminReviewDetail from "@/pages/admin/ReviewDetail";

// Fallback components for loading/error states
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Завантаження...</p>
      </div>
    </div>
  );
}

function ErrorScreen({ error }: { error: Error | null }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md px-4">
        <h1 className="text-2xl font-bold text-destructive mb-4">Помилка завантаження теми</h1>
        <p className="text-muted-foreground mb-4">
          {error?.message || "Не вдалося завантажити тему. Спробуйте оновити сторінку."}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Оновити сторінку
        </button>
      </div>
    </div>
  );
}

export function ThemeRouter() {
  const { activeTheme, isLoading, error } = useTheme();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error || !activeTheme) {
    return <ErrorScreen error={error} />;
  }

  const {
    MainLayout,
    CatalogLayout,
    ProfileLayout,
    pages: {
      HomePage,
      CatalogPage,
      CatalogSectionPage,
      ProductPage,
      CartPage,
      CheckoutPage,
      OrderSuccessPage,
      AuthPage,
      ProfilePage,
      ProfileOrdersPage,
      ProfileOrderDetailPage,
      ProfileSettingsPage,
      PropertiesPage,
      PropertyDetailPage,
      PropertyOptionPage,
      NotFoundPage,
    },
  } = activeTheme;

  return (
    <Routes>
      {/* Home page with its own layout */}
      <Route path="/" element={<MainLayout><HomePage /></MainLayout>} />
      
      {/* Auth page */}
      <Route path="/auth" element={<AuthPage />} />

      {/* Catalog routes with shared layout */}
      <Route element={<CatalogLayout />}>
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/catalog/:sectionSlug" element={<CatalogSectionPage />} />
        <Route path="/catalog/:sectionSlug/:productSlug" element={<ProductPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/order-success/:orderId" element={<OrderSuccessPage />} />

        {/* Property pages */}
        <Route path="/properties" element={<PropertiesPage />} />
        <Route path="/properties/:propertySlug" element={<PropertyDetailPage />} />
        <Route path="/properties/:propertySlug/:optionSlug" element={<PropertyOptionPage />} />
      </Route>

      {/* Profile routes (protected) */}
      <Route path="/profile" element={<ProfileLayout />}>
        <Route index element={<ProfilePage />} />
        <Route path="orders" element={<ProfileOrdersPage />} />
        <Route path="orders/:orderId" element={<ProfileOrderDetailPage />} />
        <Route path="settings" element={<ProfileSettingsPage />} />
      </Route>

      {/* Admin routes - NOT themed, uses AdminLayout directly */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="sections" element={<Sections />} />
        <Route path="sections/:sectionId" element={<SectionEdit />} />
        <Route path="properties" element={<AdminProperties />} />
        <Route path="properties/:propertyId" element={<PropertyEdit />} />
        <Route path="properties/:propertyId/options/new" element={<PropertyOptionEdit />} />
        <Route path="properties/:propertyId/options/:optionId" element={<PropertyOptionEdit />} />
        <Route path="products" element={<Products />} />
        <Route path="products/:productId" element={<ProductEdit />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/:orderId" element={<OrderDetail />} />
        <Route path="order-statuses" element={<OrderStatuses />} />
        <Route path="plugins" element={<Plugins />} />
        <Route path="plugins/:pluginId" element={<PluginSettings />} />
        <Route path="themes" element={<Themes />} />
        <Route path="themes/:themeId" element={<ThemeSettings />} />
        <Route path="shipping" element={<Shipping />} />
        <Route path="shipping/methods" element={<ShippingMethods />} />
        <Route path="shipping/methods/:methodId" element={<ShippingMethodEdit />} />
        <Route path="shipping/zones" element={<ShippingZones />} />
        <Route path="shipping/zones/:zoneId" element={<ShippingZoneEdit />} />
        <Route path="shipping/pickup-points" element={<PickupPoints />} />
        <Route path="shipping/pickup-points/:pointId" element={<PickupPointEdit />} />
        <Route path="users" element={<Users />} />
        <Route path="users/:userId" element={<UserEdit />} />
        <Route path="user-categories" element={<UserCategories />} />
        <Route path="user-categories/new" element={<UserCategoryEdit />} />
        <Route path="user-categories/:categoryId" element={<UserCategoryEdit />} />
        <Route path="user-categories/rules" element={<UserCategoryRules />} />
        <Route path="user-categories/rules/new" element={<UserCategoryRuleEdit />} />
        <Route path="user-categories/rules/:ruleId" element={<UserCategoryRuleEdit />} />
        <Route path="services" element={<PlaceholderPage />} />
        <Route path="service-requests" element={<PlaceholderPage />} />
        <Route path="languages" element={<PlaceholderPage />} />
        <Route path="settings" element={<Settings />} />
        <Route path="price-types" element={<PriceTypes />} />
        <Route path="price-types/new" element={<PriceTypeEdit />} />
        <Route path="price-types/:priceTypeId" element={<PriceTypeEdit />} />
        <Route path="discounts" element={<Discounts />} />
        <Route path="discounts/groups/new" element={<DiscountGroupEdit />} />
        <Route path="discounts/groups/:groupId" element={<DiscountGroupEdit />} />
        <Route path="discounts/new" element={<DiscountEdit />} />
        <Route path="discounts/:discountId" element={<DiscountEdit />} />
        <Route path="price-validator" element={<PriceValidator />} />
        <Route path="banners" element={<Banners />} />
        <Route path="banners/new" element={<BannerEdit />} />
        <Route path="banners/:bannerId" element={<BannerEdit />} />
        <Route path="reviews" element={<AdminReviews />} />
        <Route path="reviews/:reviewId" element={<AdminReviewDetail />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
