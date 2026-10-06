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
      // 🔴 HEAD реєструється ЯВНО. Start 1.169.x сам падає з HEAD на GET
      // (`createStartHandler`: `HEAD ?? GET ?? ANY`), але 1.167.x робив
      // простий lookup `handlers[METHOD] ?? ANY` — і HEAD ішов у SSR, віддаючи
      // HTML замість заголовків файлу, що CDN закешує НАЗАВЖДИ через
      // `immutable`. Явний рядок тримає роздачу коректною незалежно від
      // версії Start у магазині (peer `^1`). `ANY` замість двох рядків не
      // брати: роздача публічна, і роут почав би відповідати на запис.
      HEAD: ({ request }: { request: Request }) => serveMedia({ request }),
    },
  },
});
