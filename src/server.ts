import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server';
import { createServerEntry } from '@tanstack/react-start/server-entry';

/**
 * Кастомний серверний вхід (`server.entry` у `vite.config.ts`).
 *
 * Дефолтний вхід TanStack Start робить рівно те саме, але власний файл дає
 * точку розширення: перед делегацією в Start-хендлер можна перехопити запит
 * (SEO-ендпойнти тощо). Збірка віддає fetch-handler, а не Node-listener —
 * підняттям HTTP-сервера займається кореневий `server.mjs`.
 */
const startHandler = createStartHandler(defaultStreamHandler);

export default createServerEntry({
  fetch: async (request, options) => {
    // ── Точка розширення: перехоплювачі запиту ────────────────────────────
    // Тут (ПЕРЕД делегацією) вмикаються обробники, які відповідають самі й не
    // доходять до роутера. Кожен повертає `Response` або `null`.

    return startHandler(request, options);
  },
});
