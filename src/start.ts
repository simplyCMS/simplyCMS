import { createMiddleware } from '@tanstack/react-start';

/**
 * Глобальний middleware pipeline для TanStack Start.
 * Наразі мінімальний — розширюється в Phase 2+ (auth guards, logging).
 */
export default createMiddleware().server(async ({ next }) => {
  return next();
});
