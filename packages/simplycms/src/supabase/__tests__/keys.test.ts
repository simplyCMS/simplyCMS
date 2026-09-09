import { describe, expect, it } from 'vitest';
import { resolveSupabaseKeys } from '../keys';

// Контракт резолву ключів Supabase: новий publishable-ключ має пріоритет,
// legacy anon-ключ лишається fallback-ом, відсутність обох — явна помилка.

describe('resolveSupabaseKeys', () => {
  it('віддає перевагу publishable-ключу над legacy anon', () => {
    const keys = resolveSupabaseKeys({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_xxx',
      VITE_SUPABASE_ANON_KEY: 'legacy_anon_xxx',
    });

    expect(keys).toEqual({
      url: 'https://example.supabase.co',
      key: 'sb_publishable_xxx',
    });
  });

  it('відкочується на VITE_SUPABASE_ANON_KEY, якщо publishable відсутній', () => {
    const expected = {
      url: 'https://example.supabase.co',
      key: 'legacy_anon_xxx',
    };

    // publishable взагалі не оголошений
    expect(
      resolveSupabaseKeys({
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'legacy_anon_xxx',
      }),
    ).toEqual(expected);

    // publishable оголошений, але порожній (типовий стан .env після міграції)
    expect(
      resolveSupabaseKeys({
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: '',
        VITE_SUPABASE_ANON_KEY: 'legacy_anon_xxx',
      }),
    ).toEqual(expected);
  });

  it('кидає помилку, якщо жодного ключа немає', () => {
    expect(() =>
      resolveSupabaseKeys({ VITE_SUPABASE_URL: 'https://example.supabase.co' }),
    ).toThrow(/SUPABASE.*KEY/);
  });
});
