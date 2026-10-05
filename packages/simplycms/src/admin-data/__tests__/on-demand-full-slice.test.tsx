// @vitest-environment jsdom
// (vitest.config: environment 'node' — без директиви renderHook упаде на
// document is not defined; патерн — як у on-demand-contract.test.tsx)
/**
 * Контракт повного зрізу on-demand колекції (Е4-9, ред.2 — аудит Codex,
 * знахідка 6). Сторінка списку властивостей читає on-demand колекцію
 * `section_properties` БЕЗ `where` (повний зріз, `orderBy name`), а картка —
 * зріз `where id = X`. `on-demand-contract.test.tsx` покриває фільтр,
 * пагінацію, findOne і join, але не live-запит без `where` разом із записом.
 *
 * Тест — на СПРАВЖНІЙ `@tanstack/db` і СПРАВЖНІЙ колекції
 * `sectionPropertiesCollection` (фабрика on-demand + канон
 * `persistenceHandlers`) з одним спільним QueryClient. Мокнуто лише межу
 * serverFn: стаб `listSectionProperties` ФІЛЬТРУЄ «серверний» масив за
 * переданим subset (filters/sorts/limit/offset), а не ігнорує його — інакше
 * повний зріз і зріз картки були б неперевірними (стаб віддавав би все
 * будь-кому). insert/update стаби змінюють той самий масив, як справжній
 * сервер. Червоне тут = бібліотека поводиться не так, як припускає Е4-9.
 *
 * 🔴 Кожен кейс тримає ЖИВУ підписку (useLiveQuery) на час запису: без
 * живого спостерігача драфт on-demand колекції лишається видимим до
 * наступного sync-коміту (@tanstack/db 0.8.6, collection/state.js:686-745);
 * сторінки завжди підписані — тест відтворює їхню форму (Е4-13).
 */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { eq, useLiveQuery } from '@tanstack/react-db';
import type { ReactNode } from 'react';
import { awaitRevalidation } from './support/revalidation';

type Prop = {
  id: string;
  sectionId: string | null;
  name: string;
  slug: string;
  propertyType: string;
  isRequired: boolean;
  isFilterable: boolean;
  hasPage: boolean;
  sortOrder: number;
  options: null;
  createdAt: Date;
};
type Filter = { field: string[]; operator: string; value: unknown };
type Sort = { field: string[]; direction: 'asc' | 'desc' };
type Payload = {
  subset?: {
    filters?: Filter[];
    sorts?: Sort[];
    limit?: number;
    offset?: number;
  };
};

const { server, listSectionProperties, insertSectionProperties } = vi.hoisted(
  () => {
    const server: { rows: Prop[] } = { rows: [] };
    const field = (r: Record<string, unknown>, f: string[]) => r[f.join('.')];
    return {
      server,
      // Мінімальний «сервер» за контрактом impl/subset.ts: eq/in/isNull +
      // сортування + offset/limit. Невідомий оператор — гучна відмова.
      listSectionProperties: vi.fn(async ({ data }: { data: Payload }) => {
        let out = [...server.rows];
        for (const f of data.subset?.filters ?? []) {
          out = out.filter((r) => {
            const v = field(r, f.field);
            if (f.operator === 'eq') return v === f.value;
            if (f.operator === 'in') return (f.value as unknown[]).includes(v);
            if (f.operator === 'isNull') return v === null;
            throw new Error(`стаб: оператор ${f.operator} поза контрактом`);
          });
        }
        for (const s of [...(data.subset?.sorts ?? [])].reverse()) {
          out.sort((a, b) => {
            const av = field(a, s.field) as string | number;
            const bv = field(b, s.field) as string | number;
            const c = av < bv ? -1 : av > bv ? 1 : 0;
            return s.direction === 'desc' ? -c : c;
          });
        }
        const off = data.subset?.offset ?? 0;
        const lim = data.subset?.limit;
        return out.slice(off, lim !== undefined ? off + lim : undefined);
      }),
      insertSectionProperties: vi.fn(
        async ({ data }: { data: Partial<Prop>[] }) => {
          const rows = data.map(
            (d) =>
              ({
                sectionId: null,
                propertyType: 'text',
                isRequired: false,
                isFilterable: false,
                hasPage: false,
                sortOrder: 0,
                options: null,
                createdAt: new Date('2026-10-03'),
                ...d,
              }) as Prop,
          );
          server.rows.push(...rows);
          return rows;
        },
      ),
    };
  },
);
const { updateSectionProperties } = vi.hoisted(() => ({
  updateSectionProperties: vi.fn(
    async ({ data }: { data: { id: string; patch: Partial<Prop> }[] }) =>
      data.map(({ id, patch }) => {
        const i = server.rows.findIndex((r) => r.id === id);
        server.rows[i] = { ...server.rows[i]!, ...patch };
        return server.rows[i]!;
      }),
  ),
}));

vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({
    listSectionProperties,
    insertSectionProperties,
    updateSectionProperties,
    removeSectionProperties: vi.fn(async () => ({ count: 1 })),
  }),
);

import { getCollection } from '../registry';
import { sectionPropertiesCollection } from '../collections/section-properties';

function seed(): Prop[] {
  const base = {
    sectionId: null,
    propertyType: 'text',
    isRequired: false,
    isFilterable: false,
    hasPage: false,
    sortOrder: 0,
    options: null,
    createdAt: new Date('2026-01-01'),
  };
  // Порядок вставки ≠ порядок за name — сортування мусить зробити запит.
  return [
    { ...base, id: crypto.randomUUID(), name: 'Потужність', slug: 'power' },
    { ...base, id: crypto.randomUUID(), name: 'Вага', slug: 'weight' },
    { ...base, id: crypto.randomUUID(), name: 'Колір', slug: 'color' },
  ];
}

function setup() {
  server.rows = seed();
  listSectionProperties.mockClear();
  insertSectionProperties.mockClear();
  updateSectionProperties.mockClear();
  const qc = new QueryClient();
  const props = getCollection(qc, sectionPropertiesCollection);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const useFullSlice = () =>
    useLiveQuery((q) => q.from({ p: props }).orderBy(({ p }) => p.name, 'asc'));
  return { qc, props, wrapper, useFullSlice };
}

const names = (rows: readonly { name: string }[]) => rows.map((r) => r.name);

describe('повний зріз on-demand колекції (Е4-9)', () => {
  it('useLiveQuery без where над on-demand колекцією отримує ВЕСЬ довідник', async () => {
    const { wrapper, useFullSlice } = setup();
    const { result } = renderHook(useFullSlice, { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(3));
    expect(names(result.current.data)).toEqual(['Вага', 'Колір', 'Потужність']);
    // Повний зріз ІДЕ через loadSubset → queryFn (on-demand), без фільтрів.
    expect(listSectionProperties).toHaveBeenCalled();
    for (const [{ data }] of listSectionProperties.mock.calls)
      expect(data.subset?.filters ?? []).toEqual([]);
  });

  it('insert через колекцію з’являється у повному зрізі без refetch', async () => {
    const { props, wrapper, useFullSlice } = setup();
    const { result } = renderHook(useFullSlice, { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(3));
    const listCalls = listSectionProperties.mock.calls.length;
    const id = crypto.randomUUID();
    let tx!: ReturnType<typeof props.insert>;
    act(() => {
      tx = props.insert({ id, name: 'Габарити', slug: 'size' } as never);
    });
    await act(async () => {
      await tx.isPersisted.promise;
    });
    await waitFor(() => expect(result.current.data).toHaveLength(4));
    expect(names(result.current.data)).toEqual([
      'Вага',
      'Габарити',
      'Колір',
      'Потужність',
    ]);
    expect(insertSectionProperties).toHaveBeenCalledTimes(1);
    // ціна TSDB-1: +N запитів після запису (1 живий зріз -> не більше +1).
    await awaitRevalidation(listSectionProperties, listCalls);
    expect(listSectionProperties.mock.calls.length).toBeLessThanOrEqual(
      listCalls + 1,
    );
    // Серверні поля доїхали write-back-ом.
    expect(result.current.data.find((r) => r.id === id)?.createdAt).toEqual(
      new Date('2026-10-03'),
    );
  });

  it('після unmount/повторного mount повний зріз включає записаний рядок (write-back живе в кеші)', async () => {
    const { props, wrapper, useFullSlice } = setup();
    const first = renderHook(useFullSlice, { wrapper });
    await waitFor(() => expect(first.result.current.data).toHaveLength(3));
    const id = crypto.randomUUID();
    let tx!: ReturnType<typeof props.insert>;
    act(() => {
      tx = props.insert({ id, name: 'Габарити', slug: 'size' } as never);
    });
    await act(async () => {
      await tx.isPersisted.promise;
    });
    const listCalls = listSectionProperties.mock.calls.length;
    first.unmount();
    const second = renderHook(useFullSlice, { wrapper });
    await waitFor(() => expect(second.result.current.data).toHaveLength(4));
    expect(names(second.result.current.data)).toEqual([
      'Вага',
      'Габарити',
      'Колір',
      'Потужність',
    ]);
    expect(props.has(id)).toBe(true);
    // Рядок узято з кешу колекції, а не повторним запитом: remount не кличе
    // list. Пауза тут свідома: це перевірка ВІДСУТНОСТІ виклику, події, на
    // яку чекати, немає; якщо відкладений refetch зʼявиться — він у межах 30 мс.
    await act(() => new Promise((r) => setTimeout(r, 30)));
    expect(listSectionProperties).toHaveBeenCalledTimes(listCalls);
  });

  it('паралельний зріз where id = X (картка) і повний зріз (список) узгоджені після update', async () => {
    const { props, wrapper, useFullSlice } = setup();
    const target = server.rows.find((r) => r.slug === 'weight')!;
    const { result } = renderHook(
      () => ({
        list: useFullSlice(),
        card: useLiveQuery((q) =>
          q
            .from({ p: props })
            .where(({ p }) => eq(p.id, target.id))
            .findOne(),
        ),
      }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(3);
      expect(result.current.card.data?.name).toBe('Вага');
    });
    // Картка справді запитала свій зріз eq(id) у сервера.
    expect(JSON.stringify(listSectionProperties.mock.calls)).toContain(
      `"value":"${target.id}"`,
    );
    const listCalls = listSectionProperties.mock.calls.length;
    let tx!: ReturnType<typeof props.update>;
    act(() => {
      tx = props.update(target.id, (d) => {
        d.name = 'Маса';
      });
    });
    await act(async () => {
      await tx.isPersisted.promise;
    });
    expect(updateSectionProperties).toHaveBeenCalledTimes(1);
    // ціна TSDB-1: +N запитів після запису (2 живі зрізи -> не більше +2).
    await awaitRevalidation(listSectionProperties, listCalls);
    expect(listSectionProperties.mock.calls.length).toBeLessThanOrEqual(
      listCalls + 2,
    );
    // Після ревалідації обидва зрізи узгоджені зі станом сервера.
    expect(result.current.card.data?.name).toBe('Маса');
    expect(names(result.current.list.data)).toEqual([
      'Колір',
      'Маса',
      'Потужність',
    ]);
  });
});
