// Канонічний конфіг магазину: єдине джерело істини для SEO/локалі/валюти,
// набору плагінів і набору тем. Без залежностей на theme-system/plugin-system —
// модулі приходять лінивими лоадерами й валідуються у відповідних реєстрах.

/**
 * Лоадер теми. Повертає `unknown`: форма модуля стає `ThemeModule` лише після
 * `validateThemeModule` у ThemeRegistry — рантайму про неї знати не треба.
 */
export type ThemeLoader = () => Promise<{ default: unknown }>;

/** Плагін у конфізі: імʼя + ліниве завантаження модуля. */
export interface PluginRegistration {
  name: string;
  module: () => Promise<{ default: unknown }>;
}

export interface SimplyCmsSeoConfig {
  siteName: string;
  defaultTitle: string;
  titleTemplate: string;
  /** Публічна база URL — використовується в canonical/sitemap/robots. */
  siteUrl: string;
  defaultDescription: string;
}

export interface SimplyCmsConfig {
  supabase: { url: string; anonKey: string };
  seo: SimplyCmsSeoConfig;
  locale: string;
  currency: string;
  plugins?: PluginRegistration[];
  themes?: Record<string, ThemeLoader>;
}

/**
 * Typed identity для `simplycms.config.ts`.
 *
 * Дженерик, а не `(c: SimplyCmsConfig) => SimplyCmsConfig`: повертаючи рівно
 * тип аргументу, ми зберігаємо точні типи лоадерів (модуль плагіна лишається
 * `PluginModule`, а не `unknown`) — конфіг можна віддавати в `bootstrapPlugins`
 * без кастів.
 */
export function defineConfig<T extends SimplyCmsConfig>(config: T): T {
  return config;
}
