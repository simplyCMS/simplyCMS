import { describe, expect, it } from 'vitest';
import { isSupabaseEnvReady } from '../src/start';

// Гард готовності оточення для серверного admin-middleware (`src/start.ts`).
//
// Middleware виконує перевірку ролі лише тоді, коли `isSupabaseEnvReady`
// повертає true. Якщо предикат почне вимагати конкретне ім'я ключа замість
// делегування в `resolveSupabaseKeys`, guard мовчки вимкнеться на інсталяціях
// з новим publishable-ключем — і `/admin` віддасться без перевірки до гідрації.

describe('isSupabaseEnvReady', () => {
  it('true, якщо є лише новий publishable-ключ (без legacy anon)', () => {
    expect(
      isSupabaseEnvReady({
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_xxx',
      }),
    ).toBe(true);
  });

  it('true, якщо є лише legacy anon-ключ', () => {
    expect(
      isSupabaseEnvReady({
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'legacy_anon_xxx',
      }),
    ).toBe(true);
  });

  it('false без URL', () => {
    expect(
      isSupabaseEnvReady({ VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_xxx' }),
    ).toBe(false);
  });

  it('false, якщо жодного ключа немає', () => {
    expect(
      isSupabaseEnvReady({ VITE_SUPABASE_URL: 'https://example.supabase.co' }),
    ).toBe(false);
  });

  it('false, якщо ключі оголошені, але порожні', () => {
    expect(
      isSupabaseEnvReady({
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: '',
        VITE_SUPABASE_ANON_KEY: '',
      }),
    ).toBe(false);
  });
});
