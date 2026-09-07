import React from 'react';

// Theme manifest - metadata from manifest.json
export interface ThemeManifest {
  name: string;
  displayName: string;
  version: string;
  description?: string;
  author?: string;
  previewImage?: string;
  supports?: ThemeSupports;
  settings?: Record<string, ThemeSettingDefinition>;
}

export interface ThemeSupports {
  darkMode?: boolean;
  customColors?: boolean;
  catalogLayouts?: string[];
  productLayouts?: string[];
}

export interface ThemeSettingDefinition {
  type: 'color' | 'boolean' | 'select' | 'text' | 'number';
  default: string | boolean | number;
  label: string;
  description?: string;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
}

// Props for theme components - these are passed from core to theme
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

// Theme module - exported from each theme's index.ts
export interface ThemeModule {
  manifest: ThemeManifest;
  
  // Layouts
  MainLayout: React.ComponentType<{ children?: React.ReactNode }>;
  CatalogLayout: React.ComponentType;
  ProfileLayout: React.ComponentType;
  
  // Pages
  pages: ThemePages;
  
  // Reusable components (optional - for advanced customization)
  components?: ThemeComponents;
}

export interface ThemePages {
  HomePage: React.ComponentType;
  CatalogPage: React.ComponentType;
  CatalogSectionPage: React.ComponentType;
  ProductPage: React.ComponentType;
  CartPage: React.ComponentType;
  CheckoutPage: React.ComponentType;
  OrderSuccessPage: React.ComponentType;
  AuthPage: React.ComponentType;
  
  // Profile pages
  ProfilePage: React.ComponentType;
  ProfileOrdersPage: React.ComponentType;
  ProfileOrderDetailPage: React.ComponentType;
  ProfileSettingsPage: React.ComponentType;
  
  // Property pages
  PropertiesPage: React.ComponentType;
  PropertyDetailPage: React.ComponentType;
  PropertyOptionPage: React.ComponentType;
  
  // 404
  NotFoundPage: React.ComponentType;
}

export interface ThemeComponents {
  ProductCard?: React.ComponentType<ProductCardProps>;
  FilterSidebar?: React.ComponentType<FilterSidebarProps>;
  ProductGallery?: React.ComponentType<ProductGalleryProps>;
  Header?: React.ComponentType;
  Footer?: React.ComponentType;
}

// Database theme record
export interface ThemeRecord {
  id: string;
  name: string;
  display_name: string;
  version: string;
  description: string | null;
  author: string | null;
  preview_image: string | null;
  is_active: boolean;
  config: Record<string, unknown>;
  settings_schema: Record<string, ThemeSettingDefinition>;
  installed_at: string;
  updated_at: string;
}

// Theme context type
export interface ThemeContextType {
  activeTheme: ThemeModule | null;
  themeName: string;
  themeSettings: Record<string, unknown>;
  themeRecord: ThemeRecord | null;
  isLoading: boolean;
  error: Error | null;
  refreshTheme: () => Promise<void>;
}
