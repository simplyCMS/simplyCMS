import type { ThemeModule } from "./types";
import { validateThemeModule } from "./validateThemeModule";

/**
 * Лоадер теми повертає `unknown`: модуль приходить із зовнішнього пакета,
 * і його форма стає `ThemeModule` лише після `validateThemeModule`.
 */
export type ThemeLoader = () => Promise<{ default: unknown }>;

/** Тема, на яку падаємо, якщо запитану не зареєстровано */
const FALLBACK_THEME = "default";

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
   *
   * Незареєстрована тема (магазин видалив пакет, а в БД лишився старий рядок)
   * не валить сторінку — падаємо на `default`. Якщо й `default` не
   * зареєстровано — reject: підставляти нема що.
   */
  load(name: string): Promise<ThemeModule> {
    const cached = this.loadingPromises.get(name);
    if (cached) return cached;

    const loader = this.themes.get(name);
    if (!loader) {
      if (name !== FALLBACK_THEME && this.themes.has(FALLBACK_THEME)) {
        console.warn(
          `[ThemeRegistry] Theme "${name}" is not registered — falling back to "${FALLBACK_THEME}"`,
        );
        // Свідомо НЕ кешуємо під запитаною назвою: тему можуть зареєструвати
        // пізніше, і кеш робив би fallback вічним.
        return this.load(FALLBACK_THEME);
      }
      return Promise.reject(new Error(`Theme "${name}" is not registered`));
    }

    const promise: ReactThenable<ThemeModule> = loader()
      .then((themeModule) => {
        const theme = themeModule.default;
        validateThemeModule(theme);
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
