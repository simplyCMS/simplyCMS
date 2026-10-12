import { useEffect, useSyncExternalStore } from 'react';

import { isStaleChunkError, reloadOnceForStaleChunk } from './stale-chunk';

// Помилки, для яких перезавантаження відмовило (уже пробували, офлайн, сховище
// недоступне). Зовнішнє сховище, а не `useState` в ефекті: результат ефекту
// мусить перемалювати межу помилок, а `setState` в ефекті — каскад рендерів.
const failed = new WeakSet<object>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function hasFailed(error: unknown): boolean {
  return typeof error === 'object' && error !== null && failed.has(error);
}

/**
 * Хук для `errorComponent` роуту: звичайний невдалий `import()` лінивого
 * маршруту після деплою потрапляє саме в межу помилок, а не в
 * `vite:preloadError`. Повертає `true`, поки йде відновлення (помилка — застарілий
 * чанк, перезавантаження заплановане): межа показує нейтральний стан замість
 * екрана помилки. Уже пробували, офлайн чи сховище недоступне — `false`, і
 * людина бачить звичайну межу помилок.
 *
 * Перезавантаження в ефекті, не під час рендеру: рендер має бути чистим, а на
 * сервері `window` немає (серверний знімок — «відновлюємось», як і гідрація).
 */
export function useStaleChunkRecovery(error: unknown): boolean {
  const stale = isStaleChunkError(error);
  useEffect(() => {
    if (!stale || reloadOnceForStaleChunk(error)) return;
    if (typeof error === 'object' && error !== null) failed.add(error);
    for (const listener of listeners) listener();
  }, [stale, error]);
  return useSyncExternalStore(
    subscribe,
    () => stale && !hasFailed(error),
    () => stale,
  );
}
