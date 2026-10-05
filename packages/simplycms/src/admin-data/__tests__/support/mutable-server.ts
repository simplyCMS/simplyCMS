/**
 * «Сервер зі змінним станом» для тестів колекцій адмінки (Task 4, TSDB-1).
 * 🔴 Причина: після ручного запису (writeUpsert/writeDelete) @tanstack/
 * query-db-collection 1.3.4 ревалідує кожен активний on-demand зріз
 * (query.ts `updateCacheData`), а відповідь list-serverFn авторитетна.
 * Статичний стаб (`mockResolvedValueOnce`, константний SEED) тому «відкочує»
 * write-back. Тут стан живе в `rows`: мутації стаба (`upsert`/`remove`/
 * `applyOutcome`) його змінюють, наступний `list` це бачить.
 *
 * `applySubset` — виконання subset за контрактом `admin-server/impl/
 * subset.ts` (eq/in/isNull/gt/gte/lt/lte, Date — діапазонними операторами,
 * сорт + тай-брейкер id, межа limit, offset). Невідомий оператор — гучна
 * відмова. Повертає КОПІЇ рядків: спільні посилання дають
 * `TransactionError: … changed in place`.
 */
export type Filter = { field: string[]; operator: string; value: unknown };
export type Sort = { field: string[]; direction: 'asc' | 'desc' };
export type Payload = {
  subset?: {
    filters?: Filter[];
    sorts?: Sort[];
    limit?: number;
    offset?: number;
  };
};

const val = (r: object, f: string[]) =>
  (r as Record<string, unknown>)[f.join('.')];
const key = (v: unknown) => (v instanceof Date ? v.getTime() : v);
export const cmp = (a: unknown, b: unknown) => {
  const av = key(a) as string | number;
  const bv = key(b) as string | number;
  return av < bv ? -1 : av > bv ? 1 : 0;
};

function matches(v: unknown, f: Filter): boolean {
  switch (f.operator) {
    case 'eq':
      return key(v) === key(f.value);
    case 'in':
      return (f.value as unknown[]).map(key).includes(key(v));
    case 'isNull':
      return v === null || v === undefined;
    case 'gt':
      return cmp(v, f.value) > 0;
    case 'gte':
      return cmp(v, f.value) >= 0;
    case 'lt':
      return cmp(v, f.value) < 0;
    case 'lte':
      return cmp(v, f.value) <= 0;
    default:
      throw new Error(`стаб: оператор ${f.operator} поза контрактом`);
  }
}

export function applySubset<R extends { id: string }>(
  src: readonly R[],
  data: Payload | undefined,
  maxLimit = 500,
): R[] {
  const s = data?.subset;
  let out = src.map((r) => ({ ...r }));
  for (const f of s?.filters ?? [])
    out = out.filter((r) => matches(val(r, f.field), f));
  const sorts = s?.sorts ?? [];
  out.sort((a, b) => {
    for (const x of sorts) {
      const c = cmp(val(a, x.field), val(b, x.field));
      if (c !== 0) return x.direction === 'desc' ? -c : c;
    }
    return cmp(a.id, b.id); // тай-брейкер сервера (Е3-8)
  });
  const off = s?.offset ?? 0;
  return out.slice(off, off + Math.min(s?.limit ?? maxLimit, maxLimit));
}

export function createMutableServer<R extends { id: string }>(
  seed: readonly R[],
  maxLimit = 500,
) {
  const server = {
    rows: seed.map((r) => ({ ...r })) as R[],
    calls: [] as Payload[],
    /** list-serverFn: `vi.fn(server.list)` або напряму. */
    list: async (payload?: Payload | { data?: Payload }): Promise<R[]> => {
      const data = (payload as { data?: Payload } | undefined)?.data;
      server.calls.push(data ?? {});
      return applySubset(server.rows, data, maxLimit);
    },
    upsert(row: R): R {
      const i = server.rows.findIndex((r) => r.id === row.id);
      if (i < 0) server.rows.push({ ...row });
      else server.rows[i] = { ...server.rows[i]!, ...row };
      return { ...server.rows[i < 0 ? server.rows.length - 1 : i]! };
    },
    remove(id: string): void {
      server.rows = server.rows.filter((r) => r.id !== id);
    },
  };
  return server;
}
