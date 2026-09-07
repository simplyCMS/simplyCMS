/**
 * Beauty Store Theme
 *
 * Warm beige/cream palette with coral accents.
 * Inspired by AlpenStore design.
 */

import React, { useEffect } from "react";
import type { ThemeModule, ThemeManifest } from "@/lib/themes/types";
import manifestData from "./manifest.json";
import "./styles.css";

const manifest = manifestData as unknown as ThemeManifest;

// Layouts
import { BeautyCatalogLayout } from "./layouts/BeautyCatalogLayout";
import { BeautyProfileLayout } from "./layouts/BeautyProfileLayout";

// Pages
import HomePage from "./pages/HomePage";
import CatalogPage from "./pages/CatalogPage";
import CatalogSectionPage from "./pages/CatalogSectionPage";
import ProductPage from "./pages/ProductPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import OrderSuccessPage from "./pages/OrderSuccessPage";
import AuthPage from "./pages/AuthPage";
import ProfilePage from "./pages/ProfilePage";
import ProfileOrdersPage from "./pages/ProfileOrdersPage";
import ProfileOrderDetailPage from "./pages/ProfileOrderDetailPage";
import ProfileSettingsPage from "./pages/ProfileSettingsPage";
import PropertiesPage from "./pages/PropertiesPage";
import PropertyDetailPage from "./pages/PropertyDetailPage";
import PropertyOptionPage from "./pages/PropertyOptionPage";
import NotFoundPage from "./pages/NotFoundPage";

// Components
import { BeautyProductCard } from "./components/ProductCard";

// MainLayout wraps the home page with beauty-theme class
function MainLayout({ children }: { children?: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add("beauty-theme");
    return () => {
      document.documentElement.classList.remove("beauty-theme");
    };
  }, []);

  return <React.Fragment>{children}</React.Fragment>;
}

// Wrap CatalogLayout to apply beauty-theme class
function BeautyCatalogLayoutWrapper() {
  useEffect(() => {
    document.documentElement.classList.add("beauty-theme");
    return () => {
      document.documentElement.classList.remove("beauty-theme");
    };
  }, []);

  return <BeautyCatalogLayout />;
}

function BeautyProfileLayoutWrapper() {
  useEffect(() => {
    document.documentElement.classList.add("beauty-theme");
    return () => {
      document.documentElement.classList.remove("beauty-theme");
    };
  }, []);

  return <BeautyProfileLayout />;
}

const theme: ThemeModule = {
  manifest,

  MainLayout,
  CatalogLayout: BeautyCatalogLayoutWrapper,
  ProfileLayout: BeautyProfileLayoutWrapper,

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

  components: {
    ProductCard: BeautyProductCard as any,
  },
};

export default theme;
