// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from 'simplycms/i18n';
import { SupabaseProvider } from 'simplycms/supabase/SupabaseProvider';
import type { SupabaseClient } from 'simplycms/supabase/browser-client';
import { Toaster } from 'simplycms/ui/toaster';

/**
 * 🔴 Фаза 8, Step 2 (Р9б) — регресійний тест на РІВНІ СТОРІНКИ.
 *
 * `useRevalidateStorefront` уже перевірений сам по собі
 * (`revalidate-storefront.test.tsx`), але окремого доказу, що
 * `ThemeSettings.tsx` дійсно КЛИЧЕ його при збереженні, не було. Тест ловить
 * регрес виду «сторінку відрефакторили, виклик revalidateStorefront() у
 * onSuccess загубився» — саме той клас поломки, що дав живу перевірку
 * 2026-08-04 (тост «застосовано», а вітрина зі старою темою).
 */

const invalidate = vi.fn().mockResolvedValue(undefined);
const navigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ themeId: 'theme-1' }),
  useNavigate: () => navigate,
  useRouter: () => ({ invalidate }),
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
}));

import ThemeSettings from '../pages/ThemeSettings';

const THEME_ROW = {
  id: 'theme-1',
  name: 'no-schema-theme',
  display_name: 'No Schema Theme',
  version: '1.0.0',
  description: null,
  settings: {},
};

/** Двійник `supabase.from('themes')` для читання й збереження settings. */
function makeSupabase(): SupabaseClient {
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: THEME_ROW, error: null }),
        }),
      }),
      update: () => ({
        eq: async () => ({ error: null }),
      }),
    }),
  };
  return client as unknown as SupabaseClient;
}

function renderThemeSettings() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <SupabaseProvider client={makeSupabase()}>
        <I18nProvider locale="uk">
          {children}
          <Toaster />
        </I18nProvider>
      </SupabaseProvider>
    </QueryClientProvider>
  );

  return render(<ThemeSettings />, { wrapper });
}

describe('ThemeSettings (адмінка) — інвалідація при збереженні', () => {
  beforeEach(() => {
    invalidate.mockClear();
    navigate.mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response),
    );
  });

  it('збереження налаштувань скидає серверний кеш і кеш роутера (revalidateStorefront)', async () => {
    renderThemeSettings();

    const saveButton = await screen.findByRole('button', {
      name: /зберегти/i,
    });

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/revalidate-theme', {
        method: 'POST',
      });
    });
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('помилка ревалідації після успішного збереження НЕ ковтається мовчки', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response),
    );
    renderThemeSettings();

    const saveButton = await screen.findByRole('button', {
      name: /зберегти/i,
    });
    fireEvent.click(saveButton);

    // Тост про "застосовано" — брехня без вдалої ревалідації; тому чекаємо
    // саме degraded-варіант і НЕ інвалідований роутер (стара тема лишилась
    // би закешованою, тост "успіх" замаскував би це).
    await screen.findByText(/кеш вітрини не скинуто/i);
    expect(invalidate).not.toHaveBeenCalled();
  });
});
