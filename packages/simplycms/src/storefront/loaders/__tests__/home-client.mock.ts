import type { StorefrontClient } from '../../client';

/** Відповідь Supabase-запиту (data/error), яку віддає мок-білдер. */
export interface MockResult {
  data: unknown;
  error: unknown;
}

/**
 * Запис одного звернення до Supabase, зібраний по ходу ланцюга.
 * Предикати (`eq`/`is`) протоколюються повністю — інакше зникнення фільтра
 * (`is_active`, `is_featured`, `parent_id`) лишалося б безкарним.
 */
export interface MockCall {
  table: string;
  eq: Record<string, unknown>;
  is: Record<string, unknown>;
  limit: number | null;
}

export const OK: MockResult = { data: [], error: null };
export const FAIL: MockResult = {
  data: null,
  error: { message: 'RLS violation' },
};

/**
 * Ключі `results` для фази 1. Обидві добірки головної читають `products`, тому
 * ключ лише за таблицею не розрізняв би їх — і зникнення `throw` на одній із
 * них лишалося б непоміченим. Розрізняємо за предикатом `is_featured`.
 */
export const FEATURED_KEY = 'products:featured';
export const NEW_KEY = 'products:new';

export interface MockClientOptions {
  /**
   * Результат за ключем: назва таблиці або `products:featured` /
   * `products:new` для двох добірок фази 1 (точніший ключ має пріоритет).
   */
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
    if (call.table === 'products') {
      const key = 'is_featured' in call.eq ? FEATURED_KEY : NEW_KEY;
      return results[key] ?? results.products ?? OK;
    }
    return results[call.table] ?? OK;
  };

  const from = (table: string) => {
    const call: MockCall = { table, eq: {}, is: {}, limit: null };
    calls.push(call);

    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    builder.select = chain;
    builder.order = chain;
    builder.is = (column: string, value: unknown) => {
      call.is[column] = value;
      return builder;
    };
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

/** Запити фази 1 — усе, що не фільтрує за `section_id`. */
export function phaseOneCalls(calls: MockCall[]): MockCall[] {
  return calls.filter((call) => !('section_id' in call.eq));
}
