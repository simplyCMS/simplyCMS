import { describe, expect, it, vi } from 'vitest';
import { lookupMediaForRequest } from 'simplycms/storefront/media-visibility';

const serveMedia = vi.hoisted(() => vi.fn());
vi.mock('simplycms/storage', () => ({ serveMedia }));

import { Route } from '../packages/simplycms/routes/storefront/media/$';

type Handler = (ctx: { request: Request }) => unknown;
const handlers = Route.options.server?.handlers as unknown as Record<
  string,
  Handler | undefined
>;

/**
 * Проводка роуту `/media/$`: і GET, і HEAD мусять передати в `serveMedia`
 * саме `lookupMediaForRequest`. Підміна `lookup` на «усе публічне»
 * (`async () => ({ personal: true })`) інакше пройшла б усі юніти й
 * `test:schema`: pending-фото відгуку стало б видно гостям. Живий доказ —
 * крок `admin-content-reviews.mjs` у `pnpm live:smoke`.
 */
describe('/media/$ — проводка lookup', () => {
  it.each(['GET', 'HEAD'])('%s передає lookupMediaForRequest', async (m) => {
    serveMedia.mockClear();
    const request = new Request('http://shop.test/media/ab/x.png', {
      method: m,
    });
    await handlers[m]!({ request });
    expect(serveMedia).toHaveBeenCalledTimes(1);
    const [ctx, deps] = serveMedia.mock.calls[0]!;
    expect(ctx).toEqual({ request });
    expect(deps).toEqual({ lookup: lookupMediaForRequest });
    expect(deps.lookup).toBe(lookupMediaForRequest);
  });
});
