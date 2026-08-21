import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ThemeRegistry } from '../ThemeRegistry';
import { bootstrapThemes } from '../bootstrapThemes';
import type { ThemeModule } from '../types';

/** Рядок таблиці `themes` у мок-БД (лише поля, потрібні bootstrap-у). */
interface ThemeRow {
  name: string;
  display_name?: string;
  version?: string;
  is_active?: boolean;
  [key: string]: unknown;
}

/**
 * Мінімальний мок Supabase (патерн `plugin-system/__tests__/bootstrap.test.ts`):
 * thenable-білдер із `select`/`insert` + лічильник викликів `getSession`, щоб
 * довести порядок кроків (session-гард НЕ виконується без missing).
 */
function createMockSupabase(initial: ThemeRow[], signedIn = true) {
  const rows: ThemeRow[] = [...initial];
  const inserted: ThemeRow[] = [];
  // `from` рахується окремо: порожній реєстр мусить не торкатися БД ВЗАГАЛІ,
  // а порожній `inserted` цього не доводить (SELECT теж іде через from).
  const calls = { getSession: 0, from: 0 };

  const client = {
    auth: {
      getSession: async () => {
        calls.getSession += 1;
        return {
          data: { session: signedIn ? { user: { id: 'u1' } } : null },
          error: null,
        };
      },
    },
    from(table: string) {
      calls.from += 1;
      if (table !== 'themes') throw new Error(`unexpected table ${table}`);
      const builder = {
        select: () => builder,
        insert(values: ThemeRow[]) {
          for (const value of values) {
            rows.push(value);
            inserted.push(value);
          }
          return Promise.resolve({ data: values, error: null });
        },
        then<TResult>(
          onfulfilled: (value: { data: ThemeRow[]; error: null }) => TResult,
        ) {
          return Promise.resolve({ data: rows, error: null }).then(onfulfilled);
        },
      };
      return builder;
    },
  };

  return { client: client as unknown as SupabaseClient, inserted, calls };
}

/** Фабрика мінімального валідного модуля теми. */
function makeModule(name: string, version = '1.2.3'): ThemeModule {
  const Stub = () => null;
  return {
    manifest: {
      name,
      displayName: `Theme ${name}`,
      version,
      engines: { simplycms: '*' },
    },
    tokens: { primary: '221 83% 53%' },
    components: { Header: Stub, Footer: Stub },
  };
}

/** Зареєструвати тему з довільним лоадером (за замовчуванням — валідний модуль). */
function register(name: string, loader?: () => Promise<{ default: unknown }>) {
  ThemeRegistry.register(
    name,
    loader ?? (async () => ({ default: makeModule(name) })),
  );
}

describe('bootstrapThemes', () => {
  beforeEach(() => {
    for (const name of ThemeRegistry.getRegisteredThemes()) {
      ThemeRegistry.unregister(name);
    }
    ThemeRegistry.clearCache();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('усі теми вже в БД → ні load, ні getSession, ні insert', async () => {
    register('default');
    const load = vi.spyOn(ThemeRegistry, 'load');
    const { client, inserted, calls } = createMockSupabase([
      { name: 'default' },
    ]);

    await bootstrapThemes(client);

    // Типовий випадок мусить коштувати рівно один SELECT.
    expect(load).not.toHaveBeenCalled();
    expect(calls.getSession).toBe(0);
    expect(inserted).toHaveLength(0);
  });

  it('без сесії модулі навіть не вантажаться (RLS: INSERT лише адміну)', async () => {
    register('solarstore');
    const load = vi.spyOn(ThemeRegistry, 'load');
    const { client, inserted } = createMockSupabase([], false);

    await bootstrapThemes(client);

    expect(load).not.toHaveBeenCalled();
    expect(inserted).toHaveLength(0);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('відсутня тема → INSERT рівно з полями маніфеста і is_active:false', async () => {
    register('solarstore');
    const { client, inserted } = createMockSupabase([{ name: 'default' }]);

    await bootstrapThemes(client);

    expect(inserted).toEqual([
      {
        name: 'solarstore',
        display_name: 'Theme solarstore',
        version: '1.2.3',
        description: null,
        author: null,
        is_active: false,
      },
    ]);
  });

  it('помилка завантаження однієї теми не валить решту', async () => {
    register('broken', async () => ({ default: {} }));
    register('ok');
    const { client, inserted } = createMockSupabase([]);

    await bootstrapThemes(client);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('broken'),
      expect.anything(),
    );
    expect(inserted.map((row) => row.name)).toEqual(['ok']);
  });

  it('ключ реєстрації ≠ manifest.name → warn, рядок під ключем конфігу', async () => {
    register('aurora', async () => ({ default: makeModule('renamed') }));
    const { client, inserted } = createMockSupabase([]);

    await bootstrapThemes(client);

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('aurora'),
    );
    expect(inserted[0]).toMatchObject({ name: 'aurora' });
  });

  it('задовга версія обрізається до ліміту колонки varchar(20)', async () => {
    // Prerelease-версія npm цілком законно довша за 20 символів, а колонка
    // themes.version — varchar(20): без обрізання падав би ВЕСЬ batch INSERT.
    const long = '1.0.0-alpha.20260814.build.12345';
    register('aurora', async () => ({ default: makeModule('aurora', long) }));
    const { client, inserted } = createMockSupabase([]);

    await bootstrapThemes(client);

    expect(inserted[0].version).toBe(long.slice(0, 20));
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('aurora'),
    );
  });

  it('порожній реєстр → жодного запиту до БД', async () => {
    const { client, inserted, calls } = createMockSupabase([]);

    await bootstrapThemes(client);

    // Саме `from` доводить відсутність запиту: порожній inserted сумісний і з
    // виконаним SELECT-ом.
    expect(calls.from).toBe(0);
    expect(calls.getSession).toBe(0);
    expect(inserted).toHaveLength(0);
  });
});
