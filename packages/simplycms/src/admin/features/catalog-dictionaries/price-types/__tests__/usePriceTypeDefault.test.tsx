// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLiveQuery } from '@tanstack/react-db';
import { priceTypesCollection, useCollection } from 'simplycms/admin-data';
import { ROWS, wrapper } from './render-support';

const { listPriceTypes, setDefaultPriceType } = vi.hoisted(() => ({
  listPriceTypes: vi.fn(),
  setDefaultPriceType: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({ listPriceTypes, setDefaultPriceType }),
);

import { usePriceTypeDefault } from '../usePriceTypeDefault';

beforeEach(() => {
  vi.clearAllMocks();
  listPriceTypes.mockResolvedValue(ROWS);
});

describe('usePriceTypeDefault', () => {
  it('пише повернуті rows (знятий і новий дефолт) у колекцію без refetch', async () => {
    const { result } = renderHook(
      () => {
        const col = useCollection(priceTypesCollection);
        const { data } = useLiveQuery({ query: (q) => q.from({ p: col }) });
        return { apply: usePriceTypeDefault(), data };
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.data).toHaveLength(2));
    setDefaultPriceType.mockResolvedValue({
      rows: [
        { ...ROWS[0]!, isDefault: false },
        { ...ROWS[1]!, isDefault: true },
      ],
    });
    await result.current.apply(ROWS[1]!.id);
    await waitFor(() =>
      expect(result.current.data.map((r) => [r.code, r.isDefault])).toEqual(
        expect.arrayContaining([
          ['retail', false],
          ['wholesale', true],
        ]),
      ),
    );
    expect(setDefaultPriceType).toHaveBeenCalledWith({
      data: { id: ROWS[1]!.id },
    });
    expect(listPriceTypes).toHaveBeenCalledTimes(1);
  });
});
