import { createServerFn } from '@tanstack/react-start';
import {
  loadActiveTheme,
  loadStoreProfile,
} from 'simplycms/storefront/loaders';

/**
 * Дані кореня вітрини для host-а (Е6б-10): активна тема, профіль магазину й
 * публічна адреса сайту. Host доповнює їх локаллю і віддає як
 * `StorefrontRootData` (`simplycms/storefront-routes/head/head`).
 *
 * 🔴 Модуль тримає РІВНО один експорт, і саме serverFn: його імпортує
 * `__root.tsx`, тобто клієнтський контур. Тіло serverFn Start вирізає з
 * клієнтського бандла — а будь-який звичайний експорт поруч затягнув би сюди
 * лоадери разом із пулом Postgres.
 *
 * `siteUrl` — з `process.env` у рантаймі (контракт серверного env): модульна
 * константа запеклася б у білд. Кінцевий `/` обрізається ТУТ, один раз
 * (прецедент `auth/invite.ts`): споживачі клеять `${siteUrl}/шлях` і інакше
 * дали б `//`. Порожній рядок — «адреса не задана»; хто будує абсолютні URL,
 * сам вирішує, що тоді опустити.
 */
export const getStorefrontRoot = createServerFn({ method: 'GET' }).handler(
  async () => {
    const [record, storeProfile] = await Promise.all([
      loadActiveTheme(),
      loadStoreProfile(),
    ]);
    return {
      activeThemeName: record?.name ?? 'default',
      storeProfile,
      siteUrl: readSiteUrl(),
    };
  },
);

/** Попередження про невалідний `VITE_SITE_URL` — раз на процес, не на запит. */
let warnedInvalidSiteUrl = false;

/**
 * Валідність перевіряється ТУТ, а не в кожному споживачі: адреса без схеми
 * (`shop.example`) інакше пішла б у `url` JSON-LD сирим рядком, хоча `logo`
 * того ж `Organization` вже давав `null`. Невалідна адреса = незадана: краще
 * без абсолютних URL, ніж з вигаданими. Лише `http(s)` — `localhost:3000`
 * `URL` розбирає як схему `localhost:`.
 */
function readSiteUrl(): string {
  const raw = (process.env.VITE_SITE_URL ?? '').replace(/\/+$/, '');
  if (raw === '') return '';
  const parsed = URL.canParse(raw) ? new URL(raw) : null;
  if (parsed?.protocol === 'https:' || parsed?.protocol === 'http:') return raw;
  if (!warnedInvalidSiteUrl) {
    warnedInvalidSiteUrl = true;
    // Лог оператору — англійською, як інші серверні логи (не рядок інтерфейсу).
    console.warn(
      `[simplycms] VITE_SITE_URL="${raw}" is not an absolute http(s) URL; ` +
        'storefront canonical and JSON-LD are rendered without it.',
    );
  }
  return '';
}
