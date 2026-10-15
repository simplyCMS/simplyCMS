import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server';
import { createServerEntry } from '@tanstack/react-start/server-entry';
import {
  createSeoInterceptor,
  withSeoInterceptor,
} from 'simplycms/storefront-routes/seo/interceptor';
import { buildRobotsTxt } from 'simplycms/storefront-routes/seo/robots';
import { buildSitemapXml } from 'simplycms/storefront-routes/seo/sitemap';
import { checkDriverEnvOnStart } from 'simplycms/env';
import { withSecurityHeaders } from 'simplycms/server-guard';
import { languageOfConfigLocale } from 'simplycms/i18n';
import {
  declareBuiltThemes,
  declareStoreCurrency,
  declareStoreLocale,
} from 'simplycms/site';
import config from '../simplycms.config';

// Вшиті теми — ті, що зібрані з `config.themes` (Е6б-8). Сервер інакше про них
// не знає: `ThemeRegistry` живе в браузерному контурі, а рядок `themes` у БД
// лишається й після видалення пакета. Без декларації активація теми
// відмовляє (fail-closed). Модульний рівень: вхід один для dev, preview і prod.
declareBuiltThemes(Object.keys(config.themes ?? {}));

// Локаль листів (скидання пароля, запрошення): серверний код `simplycms.config`
// не бачить, тож host повідомляє її тим самим каналом (Е8-Р8). Без декларації
// ядро шле українською з одним попередженням.
declareStoreLocale(languageOfConfigLocale(config.locale));

// Валюта сум у листах замовлення — з того самого `simplycms.config`, що й
// вітрина: чек без валюти двозначний. Без декларації — дефолт ядра з
// одним попередженням.
declareStoreCurrency(config.currency);

// Група драйвера env (S3, SMTP) — «все або нічого» (Е8-Р7′). Перевірка на
// верхньому рівні, щоб помилка кинулась під час імпорту бандла в `server.mjs`
// ДО listen: часткова група не має мовчки скотитися на local-fs. Не ховати
// за `import.meta.env`/`typeof window` — бандлер міг би вирізати виклик.
// Логіка й тексти попереджень — у ядрі (`simplycms/env`), хост лише кличе.
checkDriverEnvOnStart(process.env, (line) => console.warn(`[server] ${line}`));

/**
 * База шляху server functions для Node-раннера (`server.mjs`, Р20′).
 *
 * 🔴 Start інлайнить `process.env.TSS_SERVER_FN_BASE` у збірку Vite define-ом
 * (літерал із `basepath` + `serverFns.base`, із завершальним `/`); у
 * `process.env` рантайму змінної НЕМАЄ. Тому раннер бере базу не з env, а з
 * цього експорту: від неї залежить, яка стеля тіла діє на server functions.
 */
export const SERVER_FN_BASE = process.env.TSS_SERVER_FN_BASE ?? '/_serverFn/';

/**
 * Кастомний серверний вхід (`server.entry` у `vite.config.ts`).
 *
 * Тут — точка розширення ПЕРЕД делегацією в Start-хендлер: SEO-ендпойнти
 * (`/sitemap.xml`, `/robots.txt`) відповідають самі й до роутера не доходять.
 * Вхід один для всіх трьох середовищ (dev, `vite preview`, production через
 * `server.mjs`), тому окремий vite-плагін для dev більше не потрібен.
 *
 * Збірка віддає fetch-handler, а не Node-listener — HTTP-сервер піднімає
 * кореневий `server.mjs`.
 */
const startHandler = createStartHandler(defaultStreamHandler);

const seoInterceptor = createSeoInterceptor({
  sitemap: buildSitemapXml,
  robots: buildRobotsTxt,
});

// Р27: заголовки безпеки на ВСІХ динамічних відповідях (SSR, server functions,
// `/media`, sitemap/robots) — обгортка зовнішня, тож не залежить від того, хто
// саме віддав відповідь. Статику `sirv` і власні відповіді раннера доповнює
// `server.mjs`. HSTS лише для https-сайту: origin — з `VITE_SITE_URL` у рантаймі.
export default createServerEntry({
  fetch: withSecurityHeaders(
    withSeoInterceptor(seoInterceptor, startHandler),
    process.env.VITE_SITE_URL,
  ),
});
