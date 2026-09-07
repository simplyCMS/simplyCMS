import type { ThemeModule } from './types';

type ThemeLoader = () => Promise<{ default: ThemeModule }>;

class ThemeRegistryClass {
  private themes: Map<string, ThemeLoader> = new Map();
  private loadedThemes: Map<string, ThemeModule> = new Map();

  /**
   * Register a theme loader
   */
  register(name: string, loader: ThemeLoader): void {
    this.themes.set(name, loader);
    console.log(`[ThemeRegistry] Registered theme: ${name}`);
  }

  /**
   * Unregister a theme
   */
  unregister(name: string): void {
    this.themes.delete(name);
    this.loadedThemes.delete(name);
    console.log(`[ThemeRegistry] Unregistered theme: ${name}`);
  }

  /**
   * Check if a theme is registered
   */
  has(name: string): boolean {
    return this.themes.has(name);
  }

  /**
   * Get list of registered theme names
   */
  getRegisteredThemes(): string[] {
    return Array.from(this.themes.keys());
  }

  /**
   * Load a theme by name
   */
  async load(name: string): Promise<ThemeModule> {
    // Return cached theme if already loaded
    const cached = this.loadedThemes.get(name);
    if (cached) {
      console.log(`[ThemeRegistry] Returning cached theme: ${name}`);
      return cached;
    }

    // Get loader
    const loader = this.themes.get(name);
    if (!loader) {
      throw new Error(`Theme "${name}" is not registered`);
    }

    // Load the theme
    console.log(`[ThemeRegistry] Loading theme: ${name}`);
    try {
      const module = await loader();
      const theme = module.default;
      
      // Validate theme structure
      this.validateTheme(name, theme);
      
      // Cache the loaded theme
      this.loadedThemes.set(name, theme);
      
      console.log(`[ThemeRegistry] Successfully loaded theme: ${name}`);
      return theme;
    } catch (error) {
      console.error(`[ThemeRegistry] Failed to load theme: ${name}`, error);
      throw error;
    }
  }

  /**
   * Validate theme module structure
   */
  private validateTheme(name: string, theme: ThemeModule): void {
    if (!theme.manifest) {
      throw new Error(`Theme "${name}" is missing manifest`);
    }
    if (!theme.manifest.name || !theme.manifest.displayName || !theme.manifest.version) {
      throw new Error(`Theme "${name}" manifest is incomplete`);
    }
    if (!theme.MainLayout) {
      throw new Error(`Theme "${name}" is missing MainLayout`);
    }
    if (!theme.CatalogLayout) {
      throw new Error(`Theme "${name}" is missing CatalogLayout`);
    }
    if (!theme.ProfileLayout) {
      throw new Error(`Theme "${name}" is missing ProfileLayout`);
    }
    if (!theme.pages) {
      throw new Error(`Theme "${name}" is missing pages`);
    }
    
    // Validate required pages
    const requiredPages = [
      'HomePage', 'CatalogPage', 'ProductPage', 'CartPage', 
      'CheckoutPage', 'ProfilePage', 'NotFoundPage'
    ];
    
    for (const page of requiredPages) {
      if (!theme.pages[page as keyof typeof theme.pages]) {
        throw new Error(`Theme "${name}" is missing required page: ${page}`);
      }
    }
  }

  /**
   * Clear all loaded themes from cache
   */
  clearCache(): void {
    this.loadedThemes.clear();
    console.log('[ThemeRegistry] Cache cleared');
  }

  /**
   * Get a loaded theme from cache (without loading)
   */
  getCached(name: string): ThemeModule | undefined {
    return this.loadedThemes.get(name);
  }
}

// Singleton instance
export const ThemeRegistry = new ThemeRegistryClass();
