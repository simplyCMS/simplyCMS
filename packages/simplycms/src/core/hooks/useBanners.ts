import { useQuery } from '@tanstack/react-query';
import { getBanners } from '../lib/banners';

export type { Banner, BannerButton } from 'simplycms/contracts';

/**
 * Банери одного місця розміщення.
 *
 * 🔴 Ані фільтр `is_active`, ані розклад показу більше не живуть у браузері:
 * перший переїхав у предикат запиту (RLS на `banners` немає — див.
 * `simplycms/storefront/loaders/banners`), другий рахується за годинником
 * СЕРВЕРА, тож банер «щодня 9:00–18:00» вмикається однаково для всіх
 * відвідувачів, а не по локальному часу кожного.
 */
export function useBanners(placement: string, sectionId?: string) {
  const query = useQuery({
    queryKey: ['banners', placement, sectionId ?? null],
    queryFn: () =>
      getBanners({ data: { placement, sectionId: sectionId ?? null } }),
    staleTime: 60 * 1000,
  });

  // 🔴 `data` лишається `undefined` до відповіді, а не порожнім масивом:
  // слайдер каркаса показує до цього моменту банери з SSR-лоадера, і
  // підмінити їх пустим масивом означало б блимнути порожнім екраном.
  return { data: query.data, isLoading: query.isLoading };
}
