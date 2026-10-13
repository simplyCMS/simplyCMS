import { describe, expect, it } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import {
  PRICE_VIEW_UNRESOLVED,
  priceViewKey,
  VIEWER_PRICED_META,
} from 'simplycms/react-query';
import { resetViewerPrices } from '../useViewerPriceSync';

/**
 * Fix round 3 рев'ю А6.3: пряма зміна сесії A → B (вхід за запрошенням поверх
 * чинної сесії). Сегмент `'unresolved'` спільний для всіх покупців із
 * невідомим видом, тож АКТИВНА комірка A мусить зникнути ДО `router.invalidate()`
 * — інакше B прочитав би її на час мережевого походу.
 */
const KEY = priceViewKey(
  entityKey(ENTITY.products).detail('panel'),
  PRICE_VIEW_UNRESOLVED,
);

describe('resetViewerPrices', () => {
  it("активна комірка 'unresolved' зникає до завершення router.invalidate()", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    // Активна: на неї підписаний спостерігач (рендер сторінки).
    const observer = new QueryObserver(client, {
      queryKey: KEY,
      queryFn: async () => ({ prices: 'A-wholesale' }),
      meta: VIEWER_PRICED_META,
    });
    const stop = observer.subscribe(() => {});
    client.setQueryData(KEY, { prices: 'A-wholesale' });

    let release: () => void = () => {};
    let seenDuringInvalidate: unknown = 'not-called';
    const router = {
      invalidate: () => {
        seenDuringInvalidate = client.getQueryData(KEY);
        return new Promise<void>((resolve) => {
          release = resolve;
        });
      },
    };

    const done = resetViewerPrices(client, router);
    // Поки лоадери перезапускаються — даних A під спільним сегментом немає.
    expect(seenDuringInvalidate).toBeUndefined();
    expect(client.getQueryData(KEY)).toBeUndefined();
    release();
    await done;
    stop();
  });
});
