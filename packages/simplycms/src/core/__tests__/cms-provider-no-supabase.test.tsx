// @vitest-environment jsdom
// Гард регресії: рендер CMSProvider БЕЗ VITE_SUPABASE_* не повинен кидати.
// До фіксу падав на resolveSupabaseKeys усередині SupabaseProvider — саме це
// ламало вітрину в браузері, тоді як SSR віддавав 200 (аудит 2026-08-24).
import { render, screen } from '@testing-library/react';
import { afterEach, it, vi } from 'vitest';
import { CMSProvider } from '../providers/CMSProvider';

afterEach(() => {
  vi.unstubAllEnvs();
});

it('рендериться без змінних Supabase', () => {
  vi.stubEnv('VITE_SUPABASE_URL', undefined);
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', undefined);
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', undefined);

  render(
    <CMSProvider>
      <span>вітрина</span>
    </CMSProvider>,
  );

  // `getByText` сам кидає, якщо елемент відсутній — окремих матчерів
  // jest-dom (не підключені в цьому проєкті) не треба.
  screen.getByText('вітрина');
});
