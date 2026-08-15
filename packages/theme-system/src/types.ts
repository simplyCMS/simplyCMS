import type React from 'react';
import type { Banner } from '@simplycms/objects/objects';
import type { Locale } from '@simplycms/i18n';

/**
 * Паспорт теми. Тема — це встановлювана одиниця платформи, тому маніфест
 * мінімальний: ідентичність + діапазон сумісності з ядром.
 */
export interface ThemeManifest {
  name: string;
  displayName: string;
  version: string;
  /** Semver-range сумісності з ядром, напр. `"^0.1.0"` */
  engines: { simplycms: string };
}

/**
 * Значення CSS-змінних теми.
 *
 * Ключі 1:1 відповідають НАЯВНИМ semantic-змінним shadcn (`--primary`,
 * `--background`, `--radius`, …) — нових `--color-*` не вводимо. Значення —
 * рядок рівно в тому вигляді, як стоїть у CSS: HSL-трійка `"221 83% 53%"`
 * для кольорів, довжина `"0.5rem"` для радіуса.
 *
 * Набір ключів = фактичний набір змінних, які задають теми (`themes/<тема>/tokens.ts`).
 */
export interface ThemeTokenValues {
  background?: string;
  foreground?: string;
  card?: string;
  'card-foreground'?: string;
  popover?: string;
  'popover-foreground'?: string;
  primary?: string;
  'primary-foreground'?: string;
  secondary?: string;
  'secondary-foreground'?: string;
  muted?: string;
  'muted-foreground'?: string;
  accent?: string;
  'accent-foreground'?: string;
  destructive?: string;
  'destructive-foreground'?: string;
  success?: string;
  'success-foreground'?: string;
  warning?: string;
  'warning-foreground'?: string;
  border?: string;
  input?: string;
  ring?: string;
  radius?: string;
  /**
   * Повний CSS `font-family` stack рядком, напр.
   * `"'Manrope', system-ui, sans-serif"` — не назва шрифту, а готове
   * значення для декларації. `font-mono` свідомо не вводиться (YAGNI).
   */
  'font-sans'?: string;
  /** Стек для заголовків (`h1..h6`); формат — той самий, що й `font-sans`. */
  'font-heading'?: string;
}

export interface DesignTokens extends ThemeTokenValues {
  /**
   * Перекриття для темного режиму — рендериться в окремий `.dark`-блок
   * (клас на `<html>` ставить next-themes).
   */
  dark?: ThemeTokenValues;
}

/** Опис одного налаштування теми для UI-генератора форми в адмінці */
export interface ThemeSettingDefinition {
  type: 'color' | 'boolean' | 'select' | 'text' | 'number';
  default: string | boolean | number;
  label: string;
  description?: string;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
}

/**
 * Компоненти, які тема постачає ядру.
 *
 * `Header`/`Footer` обовʼязкові — на них тримається каркас
 * (`StorefrontShell`/`ProtectedShell`). Решта — точки розширення головної.
 */
export interface ThemeComponents {
  Header: React.ComponentType;
  Footer: React.ComponentType;
  /** Hero головної. Якщо тема не задала — ядро рендерить власний `BannerSlider`. */
  HeroBanner?: React.ComponentType<{ banners: Banner[] }>;
  /**
   * Унікальні секції головної, які є вибором теми (не канонічні).
   *
   * КОНТРАКТ СЛОТА: рендериться ПІСЛЯ канонічних секцій ядра і НЕ отримує
   * жодних пропсів — дані компонент тягне сам (хуками / TanStack Query).
   */
  HomeSections?: React.ComponentType;
}

/**
 * Каталог перекладів теми: `messages[locale][key]`.
 *
 * `Locale` беремо з `@simplycms/i18n` — той самий тип, що й у ядрі, тож
 * `useThemeT` (нижче) читає обидва каталоги (ядра й теми) під одну локаль.
 * `Record<string, string>`, а НЕ union конкретних ключів: theme-system не
 * знає наперед ключів жодної теми (кожна оголошує власний `keyof typeof
 * messages.uk` локально) — це навмисно ширший за `MessageKey` ядра тип,
 * інакше довелося б розширювати замкнений `MessageKey` ключами тем, а це
 * якраз те, чого контракт уникає (втрата захисту від одруків для 961
 * core-ключа).
 */
export type ThemeMessages = Partial<Record<Locale, Record<string, string>>>;

/**
 * Одне зовнішнє font stylesheet-джерело теми (контракт v2.2).
 *
 * Межа v2.2: лише абсолютний `https:`-URL зовнішнього stylesheet
 * (напр. Google Fonts). Без `@font-face`-обʼєктів і роздачі файлів — npm-тема
 * не має каналу статики. Фільтрація — `safeFontStylesheets` (субшлях-експорт
 * `@simplycms/themes/safeFontStylesheets`).
 */
export interface ThemeFontSource {
  stylesheet: string;
}

/** Модуль теми — те, що дефолтним експортом віддає пакет теми */
export interface ThemeModule {
  manifest: ThemeManifest;
  tokens: DesignTokens;
  components: ThemeComponents;
  /** Схема налаштувань теми; формат читає UI-генератор форми в адмінці */
  settings?: Record<string, ThemeSettingDefinition>;
  /**
   * Опціональний власний каталог перекладів теми (платформа §12: «теми/плагіни
   * можуть додавати власні каталоги; ланцюжок fallback»). Відсутність поля —
   * валідна тема: додавання не breaking.
   */
  messages?: ThemeMessages;
  /** Опціональні зовнішні font stylesheet-и теми (контракт v2.2, Р4). */
  fonts?: ReadonlyArray<ThemeFontSource>;
}

/** Рядок теми в БД (таблиця `themes`) */
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
