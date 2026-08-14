import type { ComponentType } from 'react';
import type { ZodObject, ZodRawShape } from 'zod';
import type { Locale } from '@simplycms/i18n';
import type {
  HookHandler,
  PluginManifest,
  PluginModule,
} from '@simplycms/plugins/types';

/**
 * Компонент слота. `context` — те, що передав `<PluginSlot context={…}>`
 * у точці розширення (наприклад, товар у `product.detail.after`); форма
 * контексту — контракт конкретного слота, SDK її не типізує.
 */
export type SlotComponent = ComponentType<{ context?: unknown }>;

/**
 * Каталог повідомлень плагіна — дзеркало `ThemeModule.messages` (контракт
 * тем v2.1). Ключі зобовʼязані мати префікс `plugin.<name>.` — колізії з
 * замкненим `MessageKey` ядра і між плагінами виключаються неймспейсом.
 */
export type PluginMessages = Partial<Record<Locale, Record<string, string>>>;

/**
 * Декларативний контракт плагіна (спека §7, обсяг v1 — план Фази 3).
 *
 * Межі v1, зафіксовані планом: `hooks` реєструються в той самий
 * `HookRegistry`, що й слоти, але ядро НЕ емить бізнес-подій
 * (`order.created` тощо) — робочі точки розширення сьогодні лише слоти;
 * `adminRoutes`/`migrations`/`edgeFunctions`/`buckets` — декларації для
 * CLI й людини, рантайм їх не інтерпретує.
 */
export interface PluginDefinition {
  /** Машинне імʼя: `[a-z][a-z0-9-]*`. Ключ у БД, префікс таблиць і ключів i18n. */
  name: string;
  displayName: string;
  version: string;
  /** Діапазон сумісності з ядром; перевіряється `satisfies` (warn-режим на 0.x). */
  engines: { simplycms: string };
  /** Метадані реєстру/маркетплейсу — англійською (показуються з БД-рядка, не з каталогу). */
  description?: string;
  author?: string;
  /** Zod-схема налаштувань; форму рендерить адмінка (`z.toJSONSchema`). */
  settings?: ZodObject<ZodRawShape>;
  /** Слот → компонент. Реєструється як хендлер, що рендерить компонент. */
  slots?: Record<string, SlotComponent>;
  /** Хук → обробник. Виконується там, де ядро кличе `execute` (зараз — лише PluginSlot). */
  hooks?: Record<string, HookHandler>;
  messages?: PluginMessages;
  /** Тека роутів адмінки відносно кореня пакета (конвенція: './routes'). */
  adminRoutes?: string;
  /** Імена SQL-файлів у `migrations/` пакета (конвенція: `<ts>_plg_<name>_<slug>.sql`). */
  migrations?: string[];
  /** Декларація Edge Functions — без автоматизації у v1 (спека §9). */
  edgeFunctions?: string[];
  /** Декларація storage-бакетів — без автоматизації у v1 (спека §9). */
  buckets?: string[];
}

/**
 * Результат `definePlugin`: структурно задовольняє чинний `PluginModule`
 * (`register`/`unregister` згенеровані з декларацій), тож
 * `bootstrapPlugins`/`PluginLoader` працюють без змін контракту.
 */
export interface SdkPluginModule extends PluginModule {
  manifest: PluginManifest;
  definition: PluginDefinition;
  /** Дублює `definition.messages` на верхньому рівні — симетрія з `ThemeModule.messages`. */
  messages?: PluginMessages;
}
