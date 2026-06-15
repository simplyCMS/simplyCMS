import type { ThemeModule } from "./types";

type ThemeLoader = () => Promise<{ default: ThemeModule }>;

/**
 * Проміс із полями thenable-протоколу React (`status`/`value`/`reason`).
 * Коли проміс уже `fulfilled`, React `use()` розгортає значення СИНХРОННО,
 * без suspend — це усуває «висіння» компонента під час гідрації.
 */
type ReactThenable<T> = Promise<T> & {
  status?: "pending" | "fulfilled" | "rejected";
  value?: T;
  reason?: unknown;
};

class ThemeRegistryClass {
  private themes: Map<string, ThemeLoader> = new Map();
  private loadedThemes: Map<string, ThemeModule> = new Map();
  // Кеш проміс-референцій: React `use()` вимагає стабільний проміс між рендерами
  private loadingPromises: Map<string, Promise<ThemeModule>> = new Map();

  /** Зареєструвати loader для теми */
  register(name: string, loader: ThemeLoader): void {
    this.themes.set(name, loader);
  }

  /** Видалити тему з реєстру */
  unregister(name: string): void {
    this.themes.delete(name);
    this.loadedThemes.delete(name);
    this.loadingPromises.delete(name);
  }

  /** Чи зареєстрована тема */
  has(name: string): boolean {
    return this.themes.has(name);
  }

  /** Список зареєстрованих тем */
  getRegisteredThemes(): string[] {
    return Array.from(this.themes.keys());
  }

  /**
   * Завантажити тему за назвою.
   *
   * Повертає КЕШОВАНУ проміс-референцію — не `async`-функція, бо та обгортала б
   * результат у новий проміс на кожному виклику, а React `use()` вимагає
   * стабільний проміс між рендерами (інакше — попередження про uncached promise
   * і нескінченний suspend).
   */
  load(name: string): Promise<ThemeModule> {
    const cached = this.loadingPromises.get(name);
    if (cached) return cached;

    const loader = this.themes.get(name);
    if (!loader) {
      return Promise.reject(new Error(`Theme "${name}" is not registered`));
    }

    const promise: ReactThenable<ThemeModule> = loader()
      .then((themeModule) => {
        const theme = themeModule.default;
        this.validateTheme(name, theme);
        this.loadedThemes.set(name, theme);
        return theme;
      })
      .catch((error) => {
        console.error(`[ThemeRegistry] Failed to load theme: ${name}`, error);
        // Прибираємо невдалий проміс із кешу, щоб дозволити повторну спробу
        this.loadingPromises.delete(name);
        throw error;
      });

    // Анотуємо проміс полями thenable-протоколу React: щойно тема завантажена,
    // `use(load(name))` повертає її синхронно (без suspend під час гідрації).
    promise.status = "pending";
    promise.then(
      (theme) => {
        promise.status = "fulfilled";
        promise.value = theme;
      },
      (reason) => {
        promise.status = "rejected";
        promise.reason = reason;
      },
    );

    this.loadingPromises.set(name, promise);
    return promise;
  }

  /** Валідація структури ThemeModule */
  private validateTheme(name: string, theme: ThemeModule): void {
    if (!theme.manifest) {
      throw new Error(`Theme "${name}" is missing manifest`);
    }
    if (
      !theme.manifest.name ||
      !theme.manifest.displayName ||
      !theme.manifest.version
    ) {
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

    const requiredPages = [
      "HomePage",
      "CatalogPage",
      "ProductPage",
      "CartPage",
      "CheckoutPage",
      "ProfilePage",
      "NotFoundPage",
    ];

    for (const page of requiredPages) {
      if (!theme.pages[page as keyof typeof theme.pages]) {
        throw new Error(
          `Theme "${name}" is missing required page: ${page}`
        );
      }
    }
  }

  /** Очистити кеш завантажених тем */
  clearCache(): void {
    this.loadedThemes.clear();
    this.loadingPromises.clear();
  }

  /** Отримати завантажену тему з кешу (без завантаження) */
  getCached(name: string): ThemeModule | undefined {
    return this.loadedThemes.get(name);
  }
}

// Singleton
export const ThemeRegistry = new ThemeRegistryClass();
