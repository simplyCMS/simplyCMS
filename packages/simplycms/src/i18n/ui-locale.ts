import type { ContentLocale, UiLocale } from 'simplycms/contracts';
import { findLanguagePack, listLanguagePacks, type UiPart } from './packs';

// Тип — у T0 (`contracts/ui-locale`), щоб його приймала T1-логіка; значення створюють ЛИШЕ
// `resolveUiLocale` і `toUiLocale` цього файлу, приведення `as UiLocale` деінде заборонене.
export type { UiLocale };

/** Пара мов інтерфейсу сторінки: власна і кінцева ланка fallback (пакет основної мови). */
export type UiLocalePair = {
  readonly locale: UiLocale;
  /** Основна мова магазину (її пакет): кінцева ланка fallback каталогів ядра, теми й плагіна. */
  readonly fallback: UiLocale;
};

/**
 * Міст осі контенту до осі інтерфейсу (І42). Опублікована мова має пакет за побудовою
 * (І46, §19.15), тож у нормальному стані міст — тотожність: кроки 1–2 (точний код → базова
 * мова, `findLanguagePack`) знаходять пакет. Крок 3 (пакет `primary`) — деградований режим:
 * пакет опублікованої мови зник з платформи, або це лист чи профіль мовою, що його втратила.
 * Він не тихий: сервер подає сигнал у `loadLocaleSet`, а `doctor` звітує помилкою.
 *
 * Якщо пакета немає й для основної мови — кидає з переліком наявних пакетів: тиха
 * підміна `uk` показала б англомовному чи польському магазину чужий інтерфейс (Р7).
 */
export function resolveUiLocale(
  content: ContentLocale,
  primary: ContentLocale,
): UiLocale {
  const pack = findLanguagePack(content) ?? findLanguagePack(primary);
  if (!pack) {
    throw new Error(
      `simplycms/i18n: для мови «${content}» і основної «${primary}» немає мовного пакета ` +
        `інтерфейсу. Наявні пакети: ${listLanguagePacks()
          .map((p) => p.code)
          .join(', ')}.`,
    );
  }
  return pack.code as UiLocale;
}

/**
 * Обидві мови інтерфейсу сторінки за мовою контенту й основною мовою магазину: те, що
 * несуть `I18nProvider`, дані кореня вітрини й транслятор екранів помилок.
 */
export function resolveUiLocalePair(
  content: ContentLocale,
  primary: ContentLocale,
): UiLocalePair {
  return {
    locale: resolveUiLocale(content, primary),
    fallback: resolveUiLocale(primary, primary),
  };
}

/**
 * Мова інтерфейсу зі збереженого значення (профіль, env): лише ТОЧНИЙ код наявного пакета
 * з усіма названими частинами (типово `base` і `mail`; адмінка просить `['admin']`), без
 * пошуку за базовою мовою — збережене значення мусить бути тим, що власник справді обрав.
 */
export function toUiLocale(
  value: string | null,
  parts: readonly UiPart[] = ['base', 'mail'],
): UiLocale | null {
  if (value === null) return null;
  const pack = findLanguagePack(value);
  if (pack?.code !== value) return null;
  return parts.every((part) => pack.ui[part] !== undefined)
    ? (value as UiLocale)
    : null;
}

/**
 * Мова інтерфейсу адмінки (§19.6, §19.15): збережений вибір, якщо його пакет має частину
 * `admin`; інакше основна мова магазину, якщо її пакет має `admin`; інакше `en` — пакет
 * платформи, повний за тестом парності (крайній випадок: основна мова з пакетом без
 * адмінських рядків). Адмінка не кидає, навіть якщо вибрану мову прибрали з платформи.
 */
export function resolveAdminUiLocale(
  stored: string | null,
  primary: ContentLocale,
): UiLocale {
  const chosen = toUiLocale(stored, ['admin']);
  if (chosen) return chosen;
  const store = toUiLocale(resolveUiLocale(primary, primary), ['admin']);
  if (store) return store;
  const en = toUiLocale('en', ['admin']);
  if (!en) throw new Error('simplycms/i18n: пакет `en` без частини `admin`');
  return en;
}
