import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeRegistry } from '../ThemeRegistry';
import { bootstrapThemes } from '../bootstrapThemes';
import type { ThemeBootstrapRow, ThemeModule } from '../types';

/**
 * 🔴 Мокається СЕРВЕРНА поверхня (`simplycms/themes/server`), а не
 * Supabase-клієнт: після рішення B9 bootstrap не має клієнта до БД взагалі —
 * він називає рядки, а транспорт і право на запис лишаються серверу. Юніт
 * тут доводить рівно свою половину (які рядки й коли складає клієнт);
 * відмову не-адміну доводить гейт `pnpm test:schema` проти живої БД.
 */
const known: string[] = [];
const inserted: ThemeBootstrapRow[] = [];
const calls = { list: 0, register: 0 };

vi.mock('simplycms/themes/server', () => ({
  listThemeNames: async () => {
    calls.list += 1;
    return [...known];
  },
  registerThemes: async ({ data }: { data: { rows: ThemeBootstrapRow[] } }) => {
    calls.register += 1;
    inserted.push(...data.rows);
    return data.rows.length;
  },
}));

/** Наповнити «БД» іменами, які магазин уже знає. */
function seedKnown(names: string[]): void {
  known.push(...names);
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
    known.length = 0;
    inserted.length = 0;
    calls.list = 0;
    calls.register = 0;
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

  it('усі теми вже в БД → ні load, ні register', async () => {
    register('default');
    seedKnown(['default']);
    const load = vi.spyOn(ThemeRegistry, 'load');

    await bootstrapThemes(true);

    // Типовий випадок мусить коштувати рівно одне читання.
    expect(load).not.toHaveBeenCalled();
    expect(calls.list).toBe(1);
    expect(calls.register).toBe(0);
  });

  it('без права запису модулі навіть не вантажаться (запис — лише адміну)', async () => {
    register('solarstore');
    const load = vi.spyOn(ThemeRegistry, 'load');

    await bootstrapThemes(false);

    expect(load).not.toHaveBeenCalled();
    expect(calls.register).toBe(0);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('відсутня тема → рядок рівно з полями маніфеста', async () => {
    register('solarstore');
    seedKnown(['default']);

    await bootstrapThemes(true);

    // `is_active` у рядку НЕМАЄ навмисно: активність задає сервер.
    expect(inserted).toEqual([
      {
        name: 'solarstore',
        display_name: 'Theme solarstore',
        version: '1.2.3',
        description: null,
        author: null,
      },
    ]);
  });

  it('помилка завантаження однієї теми не валить решту', async () => {
    register('broken', async () => ({ default: {} }));
    register('ok');

    await bootstrapThemes(true);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('broken'),
      expect.anything(),
    );
    expect(inserted.map((row) => row.name)).toEqual(['ok']);
  });

  it('ключ реєстрації ≠ manifest.name → warn, рядок під ключем конфігу', async () => {
    register('aurora', async () => ({ default: makeModule('renamed') }));

    await bootstrapThemes(true);

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

    await bootstrapThemes(true);

    expect(inserted[0].version).toBe(long.slice(0, 20));
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('aurora'),
    );
  });

  it('порожній реєстр → жодного запиту до БД', async () => {
    await bootstrapThemes(true);

    // Саме `list` доводить відсутність запиту: порожній inserted сумісний і з
    // виконаним читанням.
    expect(calls.list).toBe(0);
    expect(calls.register).toBe(0);
  });
});
