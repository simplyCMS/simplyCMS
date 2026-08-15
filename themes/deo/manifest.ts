import type { ThemeManifest } from '@simplycms/themes/types';

/**
 * Паспорт теми (контракт v2): ідентичність + діапазон сумісності з ядром.
 * `name` ЗОБОВʼЯЗАНЕ збігатися з ключем реєстрації в `simplycms.config.ts` —
 * саме за ним резолвить активну тему `getActiveThemeSSR` і за ним же
 * `bootstrapThemes` заводить рядок у таблиці `themes`.
 */
const manifest: ThemeManifest = {
  name: 'deo',
  displayName: 'Deo',
  version: '0.1.0',
  engines: { simplycms: '>=0.3.0' },
};

export default manifest;
