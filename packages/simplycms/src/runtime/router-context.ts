import type { QueryClient } from '@tanstack/react-query';

/**
 * Контекст роутера магазину. Живе в ПАКЕТІ: loader роут-файлів ядра
 * (routes/admin/**) типізує context.queryClient звідси — дотягтись до
 * host src/routes/__root.tsx вони не можуть (зворотний напрям). Host
 * лише реекспортує цей тип.
 */
export interface RouterContext {
  readonly queryClient: QueryClient;
}
