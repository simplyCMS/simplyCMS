// @vitest-environment jsdom
// (vitest.config: environment 'node' — без директиви renderHook упаде
// на document is not defined; патерн — як у сусідніх hook-тестах репо,
// напр. registry.test.tsx. Відхилення від тексту плану — там директиви
// не було.)
/**
 * Контракт on-demand, на якому стоїть Е3 (спайк, що лишається тестом).
 * Доводить без БД: (1) предикат useLiveQuery доходить до queryFn як
 * subset-payload з полями БЕЗ аліасу; (2) друга сторінка
 * useLiveInfiniteQuery з індексом несе offset (без індексу — префікс, кейс 2б); (3) findOne по id штовхає eq(id);
 * (4) leftJoin on-demand × eager резолвиться. Join on-demand × on-demand
 * свідомо НЕ вживається (схема властивостей — двома запитами, Task 10).
 * Червоне тут = бібліотека поводиться не так, як припускає план.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  BTreeIndex,
  createCollection,
  eq,
  useLiveInfiniteQuery,
  useLiveQuery,
} from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { ReactNode } from 'react';
import { toSubsetPayload } from '../subset-payload';

type Row = { id: string; sectionId: string; createdAt: number; name: string };
type Sec = { id: string; name: string };

const rows: Row[] = Array.from({ length: 5 }, (_, i) => ({
  id: `p${i}`,
  sectionId: i % 2 ? 's1' : 's2',
  createdAt: 100 - i,
  name: `P${i}`,
}));

function setup({ indexed = true }: { indexed?: boolean } = {}) {
  const queryClient = new QueryClient();
  const calls: unknown[] = [];
  const products = createCollection(
    queryCollectionOptions<Row>({
      id: 'contract-products',
      queryClient,
      queryKey: ['contract-products', 'list'],
      syncMode: 'on-demand',
      // Е3-16: індекс сортування — сторінки йдуть {limit, offset}, без попередження.
      ...(indexed && {
        autoIndex: 'eager' as const,
        defaultIndexType: BTreeIndex,
      }),
      getKey: (r) => r.id,
      queryFn: async (ctx) => {
        const payload = toSubsetPayload(
          ctx.meta?.loadSubsetOptions as Parameters<typeof toSubsetPayload>[0],
        );
        calls.push(payload);
        // Мінімальний «сервер»: eq по полю + limit/offset.
        let out = rows;
        for (const f of payload.subset?.filters ?? [])
          out = out.filter(
            (r) => r[f.field.join('.') as keyof Row] === f.value,
          );
        const off = payload.subset?.offset ?? 0;
        return out.slice(
          off,
          payload.subset?.limit ? off + payload.subset.limit : undefined,
        );
      },
    }),
  );
  const sections = createCollection(
    queryCollectionOptions<Sec>({
      id: 'contract-sections',
      queryClient,
      queryKey: ['contract-sections', 'list'],
      getKey: (r) => r.id,
      queryFn: async () => [
        { id: 's1', name: 'Секція 1' },
        { id: 's2', name: 'Секція 2' },
      ],
    }),
  );
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { products, sections, calls, wrapper };
}

describe('on-demand контракт Е3', () => {
  it('(1) where eq доходить як filters з полем без аліасу', async () => {
    const { products, calls, wrapper } = setup();
    const { result } = renderHook(
      () =>
        useLiveQuery((q) =>
          q.from({ p: products }).where(({ p }) => eq(p.sectionId, 's1')),
        ),
      { wrapper },
    );
    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(calls).toContainEqual(
      expect.objectContaining({
        subset: expect.objectContaining({
          filters: [{ field: ['sectionId'], operator: 'eq', value: 's1' }],
        }),
      }),
    );
  });

  it('(2) друга сторінка useLiveInfiniteQuery несе offset (з індексом сортування — Е3-16)', async () => {
    const { products, calls, wrapper } = setup({ indexed: true });
    const { result } = renderHook(
      () =>
        useLiveInfiniteQuery(
          (q) =>
            q.from({ p: products }).orderBy(({ p }) => p.createdAt, 'desc'),
          { pageSize: 2 },
        ),
      { wrapper },
    );
    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(result.current.hasNextPage).toBe(true);
    await act(async () => {
      result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.data).toHaveLength(4));
    const offsets = calls.map(
      (c) => (c as { subset?: { offset?: number } }).subset?.offset,
    );
    // Виміряно: перша сторінка — limit 3 (peek), друга — { limit: 2, offset: 3 }.
    expect(offsets).toContain(3);
  });

  it('(2б) БЕЗ індексу — друга сторінка довантажується префіксом (limit росте, offset відсутній) з попередженням; З індексом — limit+offset', async () => {
    const page2 = async (indexed: boolean) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { products, calls, wrapper } = setup({ indexed });
      const { result } = renderHook(
        () =>
          useLiveInfiniteQuery(
            (q) =>
              q.from({ p: products }).orderBy(({ p }) => p.createdAt, 'desc'),
            { pageSize: 2 },
          ),
        { wrapper },
      );
      await waitFor(() => expect(result.current.data).toHaveLength(2));
      await act(async () => {
        result.current.fetchNextPage();
      });
      await waitFor(() => expect(result.current.data).toHaveLength(4));
      // Лише сторінкові payload-и (з sorts); eq-догрузки курсора відсіяні.
      const paged = calls
        .map(
          (c) => (c as { subset: { sorts: unknown[]; limit?: number } }).subset,
        )
        .filter((s) => s.sorts.length > 0);
      const warnings = warn.mock.calls.map(String);
      warn.mockRestore();
      return { paged, warnings };
    };
    const off = await page2(false);
    // UPSTREAM:TSDB-2 — docs/architecture/upstream-workarounds.md
    // Виміряно на db 0.11.3: префікс {limit: offset+limit} БЕЗ offset +
    // попередження про відсутній індекс. Червоніє, якщо бібліотека змінить
    // стратегію довантаження.
    expect(off.paged).toEqual([
      expect.objectContaining({ limit: 3 }),
      expect.objectContaining({ limit: 5 }),
    ]);
    expect(off.paged.every((s) => !('offset' in s))).toBe(true);
    expect(off.warnings.join()).toContain('requires an index on "createdAt"');
    const on = await page2(true);
    expect(on.paged[1]).toEqual(
      expect.objectContaining({ limit: 2, offset: 3 }),
    );
    expect(on.warnings).toEqual([]);
  });

  it('(3) findOne по id штовхає eq(id)', async () => {
    const { products, calls, wrapper } = setup();
    const { result } = renderHook(
      () =>
        useLiveQuery((q) =>
          q
            .from({ p: products })
            .where(({ p }) => eq(p.id, 'p3'))
            .findOne(),
        ),
      { wrapper },
    );
    await waitFor(() => expect(result.current.data?.name).toBe('P3'));
    expect(JSON.stringify(calls)).toContain('"field":["id"]');
  });

  it('(4) leftJoin on-demand × eager дає назву секції', async () => {
    const { products, sections, calls, wrapper } = setup();
    const { result } = renderHook(
      () =>
        useLiveQuery((q) =>
          q
            .from({ p: products })
            .leftJoin({ s: sections }, ({ p, s }) => eq(p.sectionId, s.id))
            .where(({ p }) => eq(p.sectionId, 's2'))
            .select(({ p, s }) => ({ id: p.id, section: s?.name })),
        ),
      { wrapper },
    );
    await waitFor(() => expect(result.current.data).toHaveLength(3));
    expect(result.current.data.every((r) => r.section === 'Секція 2')).toBe(
      true,
    );
    // 🔴 Не лише результат join: push-down фільтра по on-demand-стороні мусить
    // ДІЙТИ до серверного subset-payload, а не осісти в JS поверх ширшого
    // зрізу — інакше leftJoin «випадково» дав би правильні дані на всіх
    // рядках і тест не ловив би регрес toSubsetPayload.
    expect(calls).toContainEqual(
      expect.objectContaining({
        subset: expect.objectContaining({
          filters: [{ field: ['sectionId'], operator: 'eq', value: 's2' }],
        }),
      }),
    );
  });
});
