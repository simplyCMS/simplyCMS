// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

/**
 * К3-Е3 Step 0: ЄДИНА точка перехоплення легасі-крашу супабейз-шару
 * адмінки. Компонент-заглушка (`LegacyPageStub`) відтворює РЕАЛЬНИЙ виклик
 * ~36 сторінок `admin/pages/**` — `useSupabaseClient()`, ланцюжком до
 * `resolveSupabaseKeys(import.meta.env)`. `vi.resetModules()` + динамічний
 * імпорт у кожному тесті: `browser-client.ts` кешує клієнт module-рівневим
 * синглтоном, і без свіжого реєстру модулів другий сценарій (env є) міг би
 * побачити стан першого (env нема) чи навпаки.
 */
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
}));

afterEach(() => {
  vi.unstubAllEnvs();
  cleanup();
});

function stubNoSupabaseEnv(): void {
  vi.stubEnv('VITE_SUPABASE_URL', undefined);
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', undefined);
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', undefined);
}

async function loadFreshModules() {
  vi.resetModules();
  // 🔴 `I18nProvider` — теж ДИНАМІЧНО, з того самого свіжого реєстру: інакше
  // React Context усередині `useT()` (створений reset-нутим модулем) і
  // Context статично імпортованого `I18nProvider` — різні обʼєкти, і
  // `useT()` падає з "використано поза <I18nProvider>".
  const { LegacySupabaseBoundary } = await import('../LegacySupabaseBoundary');
  const { useSupabaseClient } =
    await import('simplycms/supabase/SupabaseProvider');
  const { I18nProvider } = await import('simplycms/i18n');
  return { LegacySupabaseBoundary, useSupabaseClient, I18nProvider };
}

describe('LegacySupabaseBoundary', () => {
  it('без Supabase env: легасі-сторінка → заглушка, без throw', async () => {
    stubNoSupabaseEnv();
    const { LegacySupabaseBoundary, useSupabaseClient, I18nProvider } =
      await loadFreshModules();

    function LegacyPageStub() {
      useSupabaseClient();
      return <p>legacy stub</p>;
    }

    expect(() =>
      render(
        <I18nProvider locale="uk">
          <LegacySupabaseBoundary>
            <LegacyPageStub />
          </LegacySupabaseBoundary>
        </I18nProvider>,
      ),
    ).not.toThrow();

    expect(
      screen.getByText('Цей розділ ще не перенесено на V2.', {
        exact: false,
      }),
    ).toBeTruthy();
    expect(screen.queryByText('legacy stub')).toBeNull();
  });

  it('з Supabase env: легасі-поведінка без змін (клієнт створюється, заглушки немає)', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_xxx');
    const { LegacySupabaseBoundary, useSupabaseClient, I18nProvider } =
      await loadFreshModules();

    function LegacyPageStub() {
      const supabase = useSupabaseClient();
      return <p>legacy stub: {supabase ? 'client ok' : 'client missing'}</p>;
    }

    render(
      <I18nProvider locale="uk">
        <LegacySupabaseBoundary>
          <LegacyPageStub />
        </LegacySupabaseBoundary>
      </I18nProvider>,
    );

    expect(screen.getByText(/client ok/)).toBeTruthy();
    expect(
      screen.queryByText('Цей розділ ще не перенесено на V2.', {
        exact: false,
      }),
    ).toBeNull();
  });

  it('стороння помилка (не SupabaseEnvMissingError) не гаситься заглушкою', async () => {
    const { LegacySupabaseBoundary } = await loadFreshModules();

    function Thrower(): never {
      throw new Error('якась інша помилка рендера');
    }

    // React у jsdom все одно логує помилку в консоль перед пробросом далі —
    // приглушуємо очікуваний шум, не факт помилки. `I18nProvider` тут не
    // потрібен: цей шлях НЕ доходить до рендера заглушки (`useT()`).
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() =>
        render(
          <LegacySupabaseBoundary>
            <Thrower />
          </LegacySupabaseBoundary>,
        ),
      ).toThrow('якась інша помилка рендера');
    } finally {
      spy.mockRestore();
    }
  });
});
