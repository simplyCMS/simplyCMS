import { use } from 'react';
import {
  trackThenable,
  type ReactThenable,
} from 'simplycms/contracts/thenable';
import { getUiPack } from './packs';
import { createTranslator } from './translator';
import type { UiLocale } from 'simplycms/contracts';
import type { PartCatalog, Translator, UiCatalogPart } from './types';

/**
 * Кеш за `${мова}:${частина}`. Це кеш ПРОМІС-референцій, а не значень: React `use()`
 * вимагає стабільний проміс між рендерами (інакше — нескінченний suspend), а анотований
 * `trackThenable` проміс після завантаження розгортається синхронно (без suspend під час
 * гідрації). Каталоги незмінні, тож кеш живе весь процес і не залежить від запиту.
 */
const cache = new Map<string, ReactThenable<PartCatalog>>();

const cacheKey = (ui: UiLocale, part: UiCatalogPart) => `${ui}:${part}`;

/**
 * Масиви частин за набором: провайдер мемоїзує транслятор за референцією масиву, а новий
 * масив на кожен рендер перемальовував би всіх споживачів `useT`. Частини незмінні, тож
 * один набір — один масив на весь процес.
 */
const sets = new Map<string, readonly PartCatalog[]>();

/**
 * Завантажує частину каталогу мови; повторний виклик повертає ТОЙ САМИЙ проміс. Не
 * `async`-функція: вона загорнула б результат у новий проміс на кожному виклику.
 *
 * Відхилений проміс видаляється з кешу (як у `ThemeRegistry`): інакше одна мережева
 * помилка чанка робила б мову мертвою до перезавантаження процесу.
 */
export function loadUiCatalog(
  ui: UiLocale,
  part: UiCatalogPart,
): ReactThenable<PartCatalog> {
  const key = cacheKey(ui, part);
  const cached = cache.get(key);
  if (cached) return cached;

  const loader = getUiPack(ui).ui[part];
  // Частина `admin` необов'язкова (§19.15): її просять лише для мови, вибраної за `admin`.
  if (!loader)
    throw new Error(`simplycms/i18n: у пакета «${ui}» немає частини «${part}»`);
  const promise = trackThenable(
    // `new Promise` ловить і синхронний викид лоадера: він теж має шлях очищення кешу.
    new Promise<PartCatalog>((resolve) => resolve(loader())).catch(
      (error: unknown) => {
        cache.delete(key);
        throw error;
      },
    ),
  );
  cache.set(key, promise);
  return promise;
}

/**
 * Частини каталогу в рендері: `use` розгортає вже завантажену частину синхронно, а
 * незавантажену призупиняє найближчий Suspense. `use` у циклі — дозволений виняток із
 * правил хуків, кількість частин стала для виклику.
 */
export function useUiCatalogs(
  ui: UiLocale,
  parts: readonly UiCatalogPart[],
): readonly PartCatalog[] {
  const catalogs: PartCatalog[] = [];
  for (const part of parts) {
    // Погляд як на звичайний `Promise`: типи `use` вимагають непорожнє `value` у
    // fulfilled-варіанті, а React однаково читає `status`/`value` з самого об'єкта.
    const promise: Promise<PartCatalog> = loadUiCatalog(ui, part);
    catalogs.push(use(promise));
  }
  const key = `${ui}:${parts.join(',')}`;
  const known = sets.get(key);
  if (known) return known;
  sets.set(key, catalogs);
  return catalogs;
}

/** Транслятор поза React (`head()`, листи, CLI): чекає частини й збирає синхронний транслятор. */
export async function loadTranslator(
  ui: UiLocale,
  parts: readonly UiCatalogPart[],
): Promise<Translator> {
  return createTranslator(
    await Promise.all(parts.map((part) => loadUiCatalog(ui, part))),
    ui,
  );
}
