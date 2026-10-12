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
import { resolveDriverEnv } from 'simplycms/env';
import { declareBuiltThemes } from 'simplycms/site';
import config from '../simplycms.config';

// Вшиті теми — ті, що зібрані з `config.themes` (Е6б-8). Сервер інакше про них
// не знає: `ThemeRegistry` живе в браузерному контурі, а рядок `themes` у БД
// лишається й після видалення пакета. Без декларації активація теми
// відмовляє (fail-closed). Модульний рівень: вхід один для dev, preview і prod.
declareBuiltThemes(Object.keys(config.themes ?? {}));

// Група драйвера env (S3, SMTP) — «все або нічого» (Е8-Р7′). Перевірка на
// верхньому рівні, щоб помилка кинулась під час імпорту бандла в `server.mjs`
// ДО listen: часткова група не має мовчки скотитися на local-fs. Не ховати
// за `import.meta.env`/`typeof window` — бандлер міг би вирізати виклик.
// Попередження друкуємо лише в проді: у dev HMR перезапускав би модуль, а
// log-драйвер пошти там норма.
{
  const driverEnv = resolveDriverEnv(process.env);
  if (process.env.NODE_ENV === 'production') {
    for (const warning of driverEnv.warnings)
      console.warn(`[server] ${warning}`);
    if (driverEnv.mail.driver === 'log') {
      console.warn(
        '[server] пошта не налаштована: листи лише в лозі сервера (SMTP_URL і MAIL_FROM).',
      );
    }
  }
}

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

export default createServerEntry({
  fetch: withSeoInterceptor(seoInterceptor, startHandler),
});
