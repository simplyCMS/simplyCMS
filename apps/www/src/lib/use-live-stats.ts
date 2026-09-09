import { useEffect, useState } from 'react';
import { FALLBACK, fetchLiveStats, type LiveStats } from './live-stats';

const CACHE_KEY = 'simplycms:live-stats:v1';
const CACHE_TTL_MS = 30 * 60 * 1000;
/** Після цього таймауту показуємо фолбеки — скелетони не мають жити вічно. */
const SETTLE_TIMEOUT_MS = 8000;

interface CacheEntry {
  at: number;
  stats: LiveStats;
}

function readCache(): LiveStats | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.at > CACHE_TTL_MS) return null;
    return entry.stats;
  } catch {
    return null;
  }
}

function writeCache(stats: LiveStats): void {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ at: Date.now(), stats } satisfies CacheEntry),
    );
  } catch {
    // sessionStorage може бути недоступний (приватний режим) — не критично
  }
}

export interface LiveStatsState {
  stats: LiveStats;
  /** true — значення з API (чи свіжого кеша), а не з build-time фолбеків. */
  live: boolean;
  /**
   * true — очікування завершене: або дані приїхали, або таймаут/відмова і
   * показуються фолбеки. До settled компоненти рендерять скелетони.
   */
  settled: boolean;
}

/**
 * Живі метрики з GitHub/npm: сесійний кеш на 30 хв (навігації в межах
 * вкладки не бомблять API); якщо API недоступні — по таймауту чесно
 * перемикаємось на build-time фолбеки без позначки live.
 */
export function useLiveStats(): LiveStatsState {
  const [state, setState] = useState<LiveStatsState>({
    stats: FALLBACK,
    live: false,
    settled: false,
  });

  useEffect(() => {
    const cached = readCache();
    if (cached) {
      // setState з таймер-колбека, не з тіла ефекту (react-hooks-правило)
      const id = window.setTimeout(
        () => setState({ stats: cached, live: true, settled: true }),
        0,
      );
      return () => window.clearTimeout(id);
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      setState((prev) =>
        prev.settled ? prev : { stats: FALLBACK, live: false, settled: true },
      );
    }, SETTLE_TIMEOUT_MS);

    void fetchLiveStats().then((fresh) => {
      if (cancelled) return;
      window.clearTimeout(timeout);
      const anyLive =
        fresh.github !== null || fresh.npm !== null || fresh.tsShare !== null;
      if (!anyLive) {
        // усі три джерела впали (офлайн/фаєрвол) — фолбеки без live-позначки
        setState({ stats: FALLBACK, live: false, settled: true });
        return;
      }
      const merged: LiveStats = {
        github: fresh.github ?? FALLBACK.github,
        npm: fresh.npm ?? FALLBACK.npm,
        tsShare: fresh.tsShare,
      };
      writeCache(merged);
      setState({ stats: merged, live: true, settled: true });
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  return state;
}
