/**
 * Ізоморфна реєстрація тем у ThemeRegistry.
 *
 * Єдиний файл замість двох (app/theme-registry.server.ts + app/providers.tsx).
 * Імпортується як side-effect з __root.tsx (клієнт) та server/themes.ts (сервер).
 */
import { ThemeRegistry } from '@simplycms/themes/ThemeRegistry';

if (!ThemeRegistry.has('default')) {
  ThemeRegistry.register('default', () =>
    import('@themes/default/index').then((m) => ({ default: m.default })),
  );
}

if (!ThemeRegistry.has('solarstore')) {
  ThemeRegistry.register('solarstore', () =>
    import('@themes/solarstore/index').then((m) => ({ default: m.default })),
  );
}
