import { StrictMode, startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { StartClient } from '@tanstack/react-start/client';
import { installStaleChunkGuard } from 'simplycms/runtime/stale-chunk';
import { prepareStorefrontHydration } from 'simplycms/storefront-routes/hydration';

// Side-effect: реєстрація тем у ThemeRegistry (до прогріву кешу нижче)
import './theme-registry';

/**
 * Прогрів активної теми й каталогу мови інтерфейсу ДО hydrateRoot — інакше route-компоненти
 * й корінь суспендяться під час першого клієнтського рендеру (деталі —
 * `prepareStorefrontHydration`). Його збій не ковтаємо: його бачить installStaleChunkGuard.
 */
async function hydrate() {
  await prepareStorefrontHydration();

  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>,
    );
  });
}

// Застарілий чанк після деплою: до гідрації, щоб подія `vite:preloadError`
// від перших же ледачих імпортів уже мала обробник.
installStaleChunkGuard(window);

void hydrate();
