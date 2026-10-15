import type { QueryClient } from '@tanstack/react-query';
import type { LocaleSet } from 'simplycms/i18n';

/**
 * Контекст роутера магазину. Живе в ПАКЕТІ: loader роут-файлів ядра
 * (routes/admin/**) типізує context.queryClient звідси — дотягтись до
 * host src/routes/__root.tsx вони не можуть (зворотний напрям). Host
 * лише реекспортує цей тип.
 */
export interface RouterContext {
  readonly queryClient: QueryClient;
  /**
   * Набір мов магазину, прочитаний у `getRouter()` (сервер — з контексту
   * запиту, клієнт — з `window.__SCMS_LOCALES__`). Лоадеру й екранам поза
   * `I18nProvider` не треба знати про ALS чи глобали: все тут.
   */
  readonly locales: LocaleSet;
}
