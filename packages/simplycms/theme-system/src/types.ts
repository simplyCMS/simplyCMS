import React from "react";

export interface ThemeManifest {
  name: string;
  displayName: string;
  version: string;
  description?: string;
  author?: string;
  thumbnail?: string;
  supports?: { darkMode?: boolean; customColors?: boolean };
  settings?: Record<string, ThemeSettingDefinition>;
}

export interface ThemeSettingDefinition {
  type: "color" | "boolean" | "select" | "text" | "number";
  default: string | boolean | number;
  label: string;
  description?: string;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
}

export interface ThemePages {
  // SSR-capable storefront pages (accept optional server-side props)
  HomePage: React.ComponentType<Record<string, unknown>>;
  CatalogPage: React.ComponentType<Record<string, unknown>>;
  CatalogSectionPage: React.ComponentType<Record<string, unknown>>;
  ProductPage: React.ComponentType<Record<string, unknown>>;
  PropertiesPage: React.ComponentType<Record<string, unknown>>;
  PropertyDetailPage: React.ComponentType<Record<string, unknown>>;
  PropertyOptionPage: React.ComponentType<Record<string, unknown>>;
  // Client-only pages (no SSR props)
  CartPage: React.ComponentType;
  CheckoutPage: React.ComponentType;
  OrderSuccessPage: React.ComponentType;
  AuthPage: React.ComponentType;
  ProfilePage: React.ComponentType;
  ProfileOrdersPage: React.ComponentType;
  ProfileOrderDetailPage: React.ComponentType;
  ProfileSettingsPage: React.ComponentType;
  NotFoundPage: React.ComponentType;
}

export interface ThemeComponents {
  ProductCard?: React.ComponentType<ProductCardProps>;
  FilterSidebar?: React.ComponentType<FilterSidebarProps>;
  ProductGallery?: React.ComponentType<ProductGalleryProps>;
  Header?: React.ComponentType;
  Footer?: React.ComponentType;
}

export interface ThemeModule {
  manifest: ThemeManifest;
  MainLayout: React.ComponentType<{ children?: React.ReactNode }>;
  CatalogLayout: React.ComponentType<{ children?: React.ReactNode }>;
  ProfileLayout: React.ComponentType<{ children?: React.ReactNode }>;
  pages: ThemePages;
  components?: ThemeComponents;
}

export interface ProductCardProps {
  product: {
    id: string;
    name: string;
    slug: string;
    price: number | null;
    old_price: number | null;
    images: string[];
    stock_status: string | null;
    section_slug?: string;
  };
  onAddToCart?: () => void;
}

export interface FilterSidebarProps {
  filters: Record<string, unknown>;
  onFilterChange: (filters: Record<string, unknown>) => void;
  properties: Array<{
    id: string;
    name: string;
    slug: string;
    property_type: string;
    is_filterable: boolean;
    options?: Array<{ id: string; name: string; slug: string }>;
  }>;
}

export interface ProductGalleryProps {
  images: string[];
  productName: string;
}

export interface ThemeRecord {
  id: string;
  name: string;
  display_name: string;
  version: string;
  description: string | null;
  author: string | null;
  preview_image: string | null;
  is_active: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Результат SSR-резолюції теми */
export interface ActiveThemeSSR {
  theme: ThemeModule;
  themeName: string;
  themeRecord: ThemeRecord;
}

export interface ThemeContextType {
  activeTheme: ThemeModule | null;
  themeName: string;
  themeSettings: Record<string, unknown>;
  themeRecord: ThemeRecord | null;
  isLoading: boolean;
  error: Error | null;
  refreshTheme: () => Promise<void>;
}
