/**
 * Ізоморфна реєстрація тем у ThemeRegistry.
 *
 * Тонкий споживач `simplycms.config.ts`: набір тем оголошено в конфізі магазину,
 * тут — лише перенесення його в реєстр. Імпортується як side-effect із
 * __root.tsx (клієнт) та storefront-routes/server/themes.ts (сервер).
 */
import { ThemeRegistry } from 'simplycms/themes/ThemeRegistry';
import config from '../simplycms.config';

for (const [name, loader] of Object.entries(config.themes ?? {})) {
  if (!ThemeRegistry.has(name)) {
    ThemeRegistry.register(name, loader);
  }
}
