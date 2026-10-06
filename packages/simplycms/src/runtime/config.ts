// Канонічний конфіг магазину: єдине джерело істини для локалі/валюти,
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

export interface SimplyCmsConfig {
  // 🔴 Поля `supabase` тут більше немає: магазин ходить у БД лише сервером
  // (`simplycms/db`), а браузер до неї не звертається взагалі. Ключі клієнта
  // до бази — це і був той контракт, який 0.4.1 знімає.
  //
  // 🔴 Поля `seo` теж немає (Е6б-11): назва, заголовок головної й опис —
  // профіль магазину в БД (адмінка, без перезбірки), а URL сайту — серверний
  // env `VITE_SITE_URL` у рантаймі. Друга копія в конфігу розходилась би з ними.
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
