// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from 'simplycms/i18n';
import { SupabaseProvider } from 'simplycms/supabase/SupabaseProvider';
import type { SupabaseClient } from 'simplycms/supabase/browser-client';
import { ThemeRegistry } from 'simplycms/themes/ThemeRegistry';

/**
 * 🔴 Гард registry-awareness списку тем.
 *
 * Рядок у таблиці `themes` і встановлений у коді модуль — незалежні шари:
 * рядок лишається від міграції/сіду навіть після видалення пакета теми.
 * Активація такої теми обертається падінням SSR на `default` — мовчазною
 * підміною. Тест доводить, що адмінка каже про це чесно: бейдж + disabled.
 */

// Роутер не піднімаємо: сторінці потрібен лише `Link` як розмітка.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
  useRouter: () => ({ invalidate: vi.fn() }),
}));

import Themes from '../pages/Themes';

const INSTALLED = 'installed-theme';
const GHOST = 'ghost-theme';

/** Двійник `supabase.from('themes').select('*').order(...)`. */
function makeSupabase(): SupabaseClient {
  const rows = [
    makeRow('t1', INSTALLED, 'Installed Theme'),
    makeRow('t2', GHOST, 'Ghost Theme'),
  ];
  const client = {
    from: () => ({
      select: () => ({
        order: async () => ({ data: rows, error: null }),
      }),
    }),
  };
  return client as unknown as SupabaseClient;
}

function makeRow(id: string, name: string, displayName: string) {
  return {
    id,
    name,
    display_name: displayName,
    version: '0.3.0',
    description: null,
    author: null,
    preview_image: null,
    is_active: false,
    created_at: '2026-01-01T00:00:00Z',
  };
}

function renderThemes() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <SupabaseProvider client={makeSupabase()}>
        <I18nProvider locale="uk">{children}</I18nProvider>
      </SupabaseProvider>
    </QueryClientProvider>
  );

  return render(<Themes />, { wrapper });
}

describe('Themes (адмінка)', () => {
  beforeEach(() => {
    ThemeRegistry.register(INSTALLED, async () => ({ default: {} }));
  });

  afterEach(() => {
    cleanup();
    ThemeRegistry.unregister(INSTALLED);
    vi.restoreAllMocks();
  });

  it('рядок без модуля: бейдж «модуль відсутній» і заблокована активація', async () => {
    renderThemes();

    await waitFor(() => expect(screen.getByText('Ghost Theme')).toBeTruthy());

    // Бейдж — рівно один, і саме в картці незареєстрованої теми.
    expect(screen.getAllByText('Модуль відсутній')).toHaveLength(1);

    const [installedButton, ghostButton] =
      screen.getAllByRole<HTMLButtonElement>('button', { name: 'Активувати' });
    expect(installedButton.disabled).toBe(false);
    expect(ghostButton.disabled).toBe(true);
  });
});
