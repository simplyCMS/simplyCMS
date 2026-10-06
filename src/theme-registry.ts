/**
 * Ізоморфна реєстрація тем у ThemeRegistry.
 *
 * Тонкий споживач `simplycms.config.ts`: набір тем оголошено в конфізі магазину,
 * тут — лише перенесення його в реєстр. Імпортується як side-effect із
 * `routes/__root.tsx` (ізоморфно: SSR і клієнт) та `client.tsx`. Сервер про
 * вшиті теми дізнається окремо — `declareBuiltThemes` у `server.ts` (Е6б-8).
 */
import { ThemeRegistry } from 'simplycms/themes/ThemeRegistry';
import config from '../simplycms.config';

for (const [name, loader] of Object.entries(config.themes ?? {})) {
  if (!ThemeRegistry.has(name)) {
    ThemeRegistry.register(name, loader);
  }
}
