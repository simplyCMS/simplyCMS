import { rootRouteId } from '@tanstack/react-router';
import type { StorefrontProfile } from 'simplycms/contracts/store-profile';
import { createTranslator, normalizeLocale } from 'simplycms/i18n';
import type { Translator } from 'simplycms/i18n';

/**
 * Хелпери `head()` роутів вітрини (Е6б-10).
 *
 * 🔴 Окрема тека, а не `storefront-routes/seo`: `seo` — server-only
 * (`contracts/server-only.ts`), а `head()` виконується і в клієнтському
 * бандлі роуту. Тому тут нуль серверних імпортів — лише i18n і типи.
 *
 * Назва магазину й локаль приходять із кореневого лоадера host-а: ядро не має
 * іншого доступу до конфігу магазину, а `head()` — звичайна функція поза
 * React-контекстом, де `useT()` непридатний.
 */

/** Дані кореневого лоадера host-а (`src/routes/__root.tsx`). */
export type StorefrontRootData = {
  activeThemeName: string;
  storeProfile: StorefrontProfile;
  siteUrl: string;
  locale: string;
};

/** Мінімум від `RouteMatch`, потрібний хелперам: типи матчів у `head()` вузькі. */
export type HeadMatch = { routeId: string; loaderData?: unknown };

/** Що сторінка каже про себе; решту добирає профіль магазину. */
export type PageHead = { title?: string; description?: string | null };

export type HeadMeta = { title: string } | { name: string; content: string };

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function isRootData(x: unknown): x is StorefrontRootData {
  return (
    isRecord(x) &&
    typeof x.activeThemeName === 'string' &&
    typeof x.siteUrl === 'string' &&
    typeof x.locale === 'string' &&
    isRecord(x.storeProfile) &&
    typeof x.storeProfile.name === 'string'
  );
}

/**
 * Дані кореневого матчу. Кидає, якщо host не повертає `StorefrontRootData`:
 * мовчазний дефолт сховав би зламану збірку магазину за безіменним `<title>`.
 */
export function readStorefrontRoot(
  matches: ReadonlyArray<HeadMatch>,
): StorefrontRootData {
  const data = matches.find((m) => m.routeId === rootRouteId)?.loaderData;
  if (!isRootData(data)) {
    throw new Error(
      'simplycms: кореневий лоадер host-а (src/routes/__root.tsx) має ' +
        'повертати StorefrontRootData — `{ ...(await getStorefrontRoot()), locale }`',
    );
  }
  return data;
}

/** «Сторінка — Магазин»; порожня назва магазину не лишає « — » на кінці. */
export function composeTitle(page: string | undefined, name: string): string {
  return page && name ? `${page} — ${name}` : page || name;
}

/** Meta заголовка й опису; порожні значення не виводяться — діє батьківський. */
function toMeta(title: string, description: string | null): HeadMeta[] {
  const meta: HeadMeta[] = [];
  if (title) meta.push({ title });
  if (description) meta.push({ name: 'description', content: description });
  return meta;
}

/**
 * `head()` сторінки вітрини: заголовок через i18n локалі магазину + назва
 * магазину; опис сторінки, а за його відсутності — опис профілю.
 */
export function storefrontHead(
  matches: ReadonlyArray<HeadMatch>,
  page: (t: Translator) => PageHead,
): { meta: HeadMeta[] } {
  const { storeProfile, locale } = readStorefrontRoot(matches);
  const own = page(createTranslator(normalizeLocale(locale)));
  return {
    meta: toMeta(
      composeTitle(own.title, storeProfile.name),
      own.description ?? storeProfile.description,
    ),
  };
}

/**
 * Meta головної — і дефолт кореня: `homeTitle`, а без нього назва магазину.
 * Окремо від `storefrontHead`, бо `homeTitle` — повний заголовок, без суфікса.
 */
export function homeHead(profile: StorefrontProfile): { meta: HeadMeta[] } {
  return {
    meta: toMeta(profile.homeTitle ?? profile.name, profile.description),
  };
}
