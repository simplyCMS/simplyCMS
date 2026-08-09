// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { I18nProvider } from '@simplycms/i18n';

/**
 * 🔴 Гард на ОБИДВА кроки скидання теми.
 *
 * Серверний кеш (`POST /api/revalidate-theme`) сам по собі нічого не дає для
 * поточної вкладки: каркасний роут `_storefront` має `staleTime: 5 * 60_000`,
 * тож TanStack Router до п'яти хвилин віддає закешований `themeName`. Живою
 * перевіркою 2026-08-04 це виглядало так: тема в БД змінена, тост каже
 * «Зміни застосовані на сайті», а вітрина показує стару — до hard-refresh-у.
 *
 * Тому тест перевіряє саме ПАРУ викликів. Прибереш `router.invalidate()` —
 * тест червоніє, а не мовчить.
 */

const invalidate = vi.fn().mockResolvedValue(undefined);

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate }),
}));

import { useRevalidateStorefront } from '../lib/revalidateTheme';

// I18nProvider — як у проді: текст помилки бере з каталогу через `useT()`.
const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider locale="uk">{children}</I18nProvider>
);

describe('useRevalidateStorefront', () => {
  beforeEach(() => {
    invalidate.mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response),
    );
  });

  it('скидає серверний кеш І інвалідовує роутер', async () => {
    const { result } = renderHook(() => useRevalidateStorefront(), {
      wrapper,
    });

    await act(async () => {
      await result.current();
    });

    expect(fetch).toHaveBeenCalledWith('/api/revalidate-theme', {
      method: 'POST',
    });
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('на помилку сервера кидає і НЕ інвалідовує роутер', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response),
    );
    const { result } = renderHook(() => useRevalidateStorefront(), {
      wrapper,
    });

    await expect(result.current()).rejects.toThrow('403');
    // Інвалідація без скинутого серверного кешу лише перечитала б те саме
    // старе значення — і замаскувала б справжню помилку зеленим станом.
    expect(invalidate).not.toHaveBeenCalled();
  });
});
