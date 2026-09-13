import { createFileRoute } from '@tanstack/react-router';
import { serveMedia } from 'simplycms/storage';

/**
 * GET `/media/*` — роздача файлів драйвера сховища (рішення Е2-3).
 *
 * 🔴 Роут Start, а не другий `sirv`-маунт у `server.mjs`: `sirv` не діє в
 * dev (там сервером керує Vite), тож маунт створив би два різні шляхи —
 * і поламані картинки в dev при зелених прод-тестах. Один роут працює
 * однаково в dev, prod, пілоті й `live:smoke`.
 *
 * 🔴 Файл лишає ЄДИНИЙ export — `Route`. Named export звідси пережив би
 * стрипінг властивості `server` і затягнув `node:fs` і корінь сховища в
 * клієнтський бандл; логіка тому живе в `simplycms/storage/serve`.
 * Ловить це Gate C пілота.
 *
 * 🔴 Splat (`$`), а не `$key`: ключ містить `/` (шард), і сегментний
 * параметр обрізав би його по першому слешу.
 */
export const Route = createFileRoute('/media/$')({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => serveMedia({ request }),
    },
  },
});
