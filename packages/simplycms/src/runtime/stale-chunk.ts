import { BUILD_ID } from './build-id';

/**
 * Застарілий чанк після деплою. Вкладка, відкрита до деплою, просить файли
 * старої збірки за хешованими іменами, а на сервері вже нова — динамічний
 * імпорт падає. Повтор того самого імпорту марний (той самий відсутній хеш),
 * лікує лише перезавантаження на свіжий HTML.
 *
 * Два канали одного збою: подія `vite:preloadError` (імпорти із залежностями,
 * `installStaleChunkGuard`) і межа помилок роутера (звичайний `import()`
 * лінивого маршруту, `useStaleChunkRecovery` у `stale-chunk-react`). Vite
 * кидає подію лише для обгорнутих у `__vitePreload` імпортів, тож без межі
 * головний сценарій лишився б непокритим.
 *
 * Перезавантажуємо один раз на збірку вкладки й повідомлення помилки: сторож у
 * `sessionStorage` не дає зациклитись, якщо після перезавантаження файл таки
 * відсутній (збій мережі, недодеплоєний CDN) — тоді людина бачить звичайну
 * межу помилок. Client-safe: ні Node, ні `window` на рівні модуля.
 */

/**
 * Свій предикат, а не `isModuleNotFoundError` з `@tanstack/router-core`:
 * `@tanstack/react-router` його не реекспортує. Префікси: Chromium, Firefox,
 * Safari плюс провал передзавантаження CSS у Vite.
 */
const STALE_CHUNK_PREFIXES = [
  'Failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'Importing a module script failed',
  'Unable to preload CSS',
];

export function isStaleChunkError(error: unknown): boolean {
  const message = (error as { message?: unknown } | null)?.message;
  return (
    typeof message === 'string' &&
    STALE_CHUNK_PREFIXES.some((p) => message.startsWith(p))
  );
}

export const CHUNK_RELOAD_KEY_PREFIX = 'simplycms:chunk-reload:';

export interface ReloadDeps {
  /** Сховище вкладки (`sessionStorage`); геттер, бо доступ може кидати. */
  session: () => Pick<Storage, 'getItem' | 'setItem'>;
  reload: () => void;
  /** Збірка, яку виконує вкладка: після перезавантаження вона вже інша. */
  build: string;
  online: () => boolean;
}

const browserDeps: ReloadDeps = {
  session: () => window.sessionStorage,
  reload: () => window.location.reload(),
  build: BUILD_ID,
  online: () => navigator.onLine !== false,
};

// Перезавантаження вже заплановане в цьому документі: друга помилка того ж
// збою (подія Vite і межа помилок — обидва канали) не має показати запасний
// екран.
let reloadPending = false;

/**
 * `true` — перезавантаження заплановане (показувати збій не треба);
 * `false` — не застарілий чанк, уже пробували, офлайн або сховище недоступне: без сторожа петля
 * можлива, тож вирішує людина кнопкою.
 */
export function reloadOnceForStaleChunk(
  error: unknown,
  deps: ReloadDeps = browserDeps,
): boolean {
  // Перезавантаження лікує лише застарілий чанк; чужу помилку не чіпаємо.
  if (!isStaleChunkError(error)) return false;
  if (reloadPending) return true;
  // Офлайн перезавантаження дало б сторінку браузера «немає зʼєднання».
  if (!deps.online()) return false;
  const message = String(
    (error as { message?: unknown } | null)?.message ?? error,
  );
  // Збірка в ключі: Safari пише «Importing a module script failed.» без URL,
  // тож без неї ключ був би однаковий для всіх деплоїв, і після першого
  // відновлення вкладка більше не відновлювалась би сама.
  const key = `${CHUNK_RELOAD_KEY_PREFIX}${deps.build}:${message}`;
  try {
    const session = deps.session();
    if (session.getItem(key)) return false;
    session.setItem(key, '1');
  } catch {
    // Приватний режим, заборонене сховище: сторожа немає — не ризикуємо петлею.
    return false;
  }
  reloadPending = true;
  deps.reload();
  return true;
}

/**
 * Лінивий бекенд у запиті чи мутації, передзавантаження за наміром: туди межа
 * помилок не дістає, зате Vite кидає `vite:preloadError` на кожен провал
 * динамічного імпорту. `preventDefault` — лише коли перезавантаження справді
 * заплановане, інакше помилка йде далі до свого обробника.
 */
export function installStaleChunkGuard(win: Window): void {
  win.addEventListener('vite:preloadError', (event) => {
    const error = (event as Event & { payload?: unknown }).payload;
    if (reloadOnceForStaleChunk(error)) event.preventDefault();
  });
}
