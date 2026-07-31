import { StrictMode, startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { StartClient } from '@tanstack/react-start/client';
import { ThemeRegistry } from '@simplycms/themes/ThemeRegistry';
import { readActiveThemeName } from './active-theme';

// Side-effect: реєстрація тем у ThemeRegistry (до прогріву кешу нижче)
import './theme-registry';

/**
 * Прогріваємо кеш активної теми ДО hydrateRoot. Інакше route-компоненти
 * суспендяться на `use(ThemeRegistry.load(themeName))` під час першого
 * клієнтського рендеру, і вливання стрімлених SSR-даних (`updateMatch`) б'є
 * setState по ще не змонтованому піддереву → попередження «state update on a
 * component that hasn't mounted yet».
 *
 * Назву активної теми проброшує сервер інлайн-скриптом (див. active-theme.ts),
 * тож вантажимо лише її — без зайвих бандлів неактивних тем.
 */
async function hydrate() {
  const activeTheme = readActiveThemeName() ?? 'default';

  await ThemeRegistry.load(activeTheme).catch(() => {
    // Помилку теми не блокуємо гідрацію — її обробить use()/error boundary
  });

  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>,
    );
  });
}

void hydrate();
