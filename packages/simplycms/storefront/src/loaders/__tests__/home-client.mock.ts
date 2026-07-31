import type { StorefrontClient } from '../../client';

/** Відповідь Supabase-запиту (data/error), яку віддає мок-білдер. */
export interface MockResult {
  data: unknown;
  error: unknown;
}

/** Запис одного звернення до Supabase, зібраний по ходу ланцюга. */
export interface MockCall {
  table: string;
  eq: Record<string, unknown>;
  limit: number | null;
}

export const OK: MockResult = { data: [], error: null };
export const FAIL: MockResult = {
  data: null,
  error: { message: 'RLS violation' },
};

export interface MockClientOptions {
  /** Результат за назвою таблиці (фаза 1 лоадера) */
  results?: Record<string, MockResult>;
  /** Кореневі секції, які повертає запит `sections` */
  rootSections?: { id: string; name: string; slug: string }[];
  /** Результат секційного запиту за `section_id` (фаза 2 лоадера) */
  bySection?: Record<string, MockResult>;
}

/**
 * Thenable-білдер Supabase з протоколюванням: кожен ланцюг `from().…`
 * записується в `calls`, а результат добирається за таблицею / `section_id`.
 */
export function makeClient(options: MockClientOptions = {}) {
  const calls: MockCall[] = [];
  const results: Record<string, MockResult> = {
    banners: OK,
    products: OK,
    sections: OK,
    ...options.results,
  };

  const resolveResult = (call: MockCall): MockResult => {
    const sectionId = call.eq.section_id;
    if (typeof sectionId === 'string') {
      return options.bySection?.[sectionId] ?? OK;
    }
    if (call.table === 'sections' && options.rootSections) {
      return { data: options.rootSections, error: null };
    }
    return results[call.table] ?? OK;
  };

  const from = (table: string) => {
    const call: MockCall = { table, eq: {}, limit: null };
    calls.push(call);

    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    builder.select = chain;
    builder.is = chain;
    builder.order = chain;
    builder.eq = (column: string, value: unknown) => {
      call.eq[column] = value;
      return builder;
    };
    builder.limit = (count: number) => {
      call.limit = count;
      return builder;
    };
    builder.then = <TResult>(onfulfilled: (value: MockResult) => TResult) =>
      Promise.resolve(resolveResult(call)).then(onfulfilled);
    return builder;
  };

  return { client: { from } as unknown as StorefrontClient, calls };
}

/** Запити фази 2 — ті, що фільтрують за `section_id`. */
export function sectionCalls(calls: MockCall[]): MockCall[] {
  return calls.filter((call) => 'section_id' in call.eq);
}
