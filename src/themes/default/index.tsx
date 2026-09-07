/**
 * SolarStore Default Theme
 * 
 * This is the default theme that ships with the CMS.
 * It re-exports existing components from the main codebase.
 */

import React from 'react';
import type { ThemeModule, ThemeManifest } from '@/lib/themes/types';
import manifestData from './manifest.json';

// Cast the imported JSON to ThemeManifest type
const manifest = manifestData as unknown as ThemeManifest;

// Layouts - re-export existing layouts
import { CatalogLayout } from '@/components/catalog/CatalogLayout';
import { ProfileLayout } from '@/components/profile/ProfileLayout';

// Pages - re-export existing pages
import Index from '@/pages/Index';
import Catalog from '@/pages/Catalog';
import CatalogSection from '@/pages/CatalogSection';
import ProductDetail from '@/pages/ProductDetail';
import Cart from '@/pages/Cart';
import Checkout from '@/pages/Checkout';
import OrderSuccess from '@/pages/OrderSuccess';
import Auth from '@/pages/Auth';
import Profile from '@/pages/Profile';
import ProfileOrders from '@/pages/ProfileOrders';
import ProfileOrderDetail from '@/pages/ProfileOrderDetail';
import ProfileSettings from '@/pages/ProfileSettings';
import Properties from '@/pages/Properties';
import PropertyDetail from '@/pages/PropertyDetail';
import PropertyPage from '@/pages/PropertyPage';
import NotFound from '@/pages/NotFound';

// Components - re-export existing catalog components
import { ProductCard } from '@/components/catalog/ProductCard';
import { FilterSidebar } from '@/components/catalog/FilterSidebar';
import { ProductGallery } from '@/components/catalog/ProductGallery';

// Main layout wrapper for home page (uses its own layout)
function MainLayout({ children }: { children?: React.ReactNode }) {
  // Index page includes its own header/footer
  return <React.Fragment>{children}</React.Fragment>;
}

const theme: ThemeModule = {
  manifest,
  
  // Layouts
  MainLayout,
  CatalogLayout,
  ProfileLayout,
  
  // Pages
  pages: {
    HomePage: Index,
    CatalogPage: Catalog,
    CatalogSectionPage: CatalogSection,
    ProductPage: ProductDetail,
    CartPage: Cart,
    CheckoutPage: Checkout,
    OrderSuccessPage: OrderSuccess,
    AuthPage: Auth,
    ProfilePage: Profile,
    ProfileOrdersPage: ProfileOrders,
    ProfileOrderDetailPage: ProfileOrderDetail,
    ProfileSettingsPage: ProfileSettings,
    PropertiesPage: Properties,
    PropertyDetailPage: PropertyDetail,
    PropertyOptionPage: PropertyPage,
    NotFoundPage: NotFound,
  },
  
  // Optional reusable components
  components: {
    ProductCard,
    FilterSidebar,
    ProductGallery,
  },
};

export default theme;
