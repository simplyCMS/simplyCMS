import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAnonSupabaseClient } from '../anon-client';
import { createServerSupabase } from '../server-client';

// Контракт серверного env (спека CLI v1 §7): серверні фабрики читають env
// У МОМЕНТ ВИКЛИКУ, а не при імпорті модуля, і падають гучно без ключів.
// Обидва модулі імпортовано статично — ДО будь-якого стабу: якби env читався
// на модуль-рівні (запікання) чи кешувався, стаби нижче не мали б ефекту.
//
// 🔴 ДЖЕРЕЛО (process.env, а не import.meta.env) цей тест НЕ доводить:
// у vitest `import.meta.env` — Proxy над `process.env`, тобто це ОДИН обʼєкт,
// і відкат фабрик на `import.meta.env` лишив би тест зеленим. Джерело стереже
// лінт-селектор `no-restricted-syntax` (SERVER_ENV_FILES, eslint.config.mjs).

/** Приватне поле supabase-js — спосіб побачити, який URL резолвнула фабрика. */
const clientUrl = (client: unknown): string =>
  (client as { supabaseUrl: string }).supabaseUrl;

/** Гарантує відсутність усіх ключів незалежно від env машини/CI. */
function stubNoSupabaseEnv(): void {
  vi.stubEnv('VITE_SUPABASE_URL', undefined);
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', undefined);
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', undefined);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe.each([
  ['createAnonSupabaseClient', (): unknown => createAnonSupabaseClient()],
  // cookieHeader передаємо явно — поза request-контекстом ALS-хедерів немає.
  ['createServerSupabase', (): unknown => createServerSupabase('')],
])('%s: читає env у момент виклику', (_name, factory) => {
  it('падає гучно, коли env не наповнений', () => {
    stubNoSupabaseEnv();
    expect(factory).toThrow(/VITE_SUPABASE_URL/);
  });

  it('бачить значення, застабані ПІСЛЯ імпорту модуля', () => {
    stubNoSupabaseEnv();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://first.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_xxx');
    expect(clientUrl(factory())).toBe('https://first.supabase.co');
  });

  it('перечитує env на кожен виклик (без модуль-рівневого кешу)', () => {
    stubNoSupabaseEnv();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://first.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'legacy_anon_xxx');
    expect(clientUrl(factory())).toBe('https://first.supabase.co');

    vi.stubEnv('VITE_SUPABASE_URL', 'https://second.supabase.co');
    expect(clientUrl(factory())).toBe('https://second.supabase.co');
  });
});
