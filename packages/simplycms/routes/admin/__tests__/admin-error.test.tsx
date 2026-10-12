// @vitest-environment jsdom
import type { ComponentType, ReactNode } from 'react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { I18nProvider } from 'simplycms/i18n';

/**
 * Хвіст рев'ю Task 10: `errorComponent: AdminError` роуту `/admin`
 * (`admin.tsx`). Доводимо, що відомий код (`InsecureContextError`)
 * рендерить перекладений рядок, а решта — `error.message` дослівно, тим
 * самим шляхом, що й кореневий `ErrorBoundary`.
 *
 * 🔴 `createFileRoute` мокнуто в форму `(options) => ({ options })`
 * (прецедент `home-n-plus-one.test.tsx`): реальний runtime роутера тут не
 * потрібен, а `Route.options.errorComponent` — саме та функція, яку
 * `admin.tsx` реєструє поруч із `pendingComponent`.
 *
 * 🔴 `AdminLayout` і `simplycms/storefront-routes/server/auth` замоковано,
 * щоб імпорт `../admin` лишався легким компонентним тестом, а не тягнув
 * auth/db-граф, якого цей тест не перевіряє.
 */
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
  Outlet: () => null,
  redirect: (opts: unknown) => {
    throw opts;
  },
}));

vi.mock('simplycms/admin/layouts/AdminLayout', () => ({
  AdminLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('simplycms/storefront-routes/server/auth', () => ({
  getUser: vi.fn(),
  isAdmin: vi.fn(),
}));

// Предикат справжній, перезавантаження — шпигун: jsdom не дає підмінити
// `location.reload`, а доводимо саме проводку межі помилок.
vi.mock('simplycms/runtime/stale-chunk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('simplycms/runtime/stale-chunk')>()),
  reloadOnceForStaleChunk: vi.fn(() => true),
}));

import { reloadOnceForStaleChunk } from 'simplycms/runtime/stale-chunk';
import { Route } from '../admin';

/** Симулює серіалізовану помилку з `beforeLoad`: лише `name`/`message` доїжджають до клієнта (К3-13). */
function toClientError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

function renderAdminError(error: Error) {
  // 🔴 `Route.options` типізовано широким union-ом реального роутера (тут
  // мокнутого лише в РАНТАЙМІ — vi.mock типів не міняє), тож пряме звуження
  // до сигнатури `AdminError` компілятор відхиляє (TS2352, «insufficient
  // overlap»); подвійний каст через `unknown` — саме той обхід, що радить
  // сама помилка компілятора.
  const AdminError = (
    Route.options as unknown as {
      errorComponent: ComponentType<{ error: Error }>;
    }
  ).errorComponent;
  return render(
    <I18nProvider locale="uk">
      <AdminError error={error} />
    </I18nProvider>,
  );
}

describe('AdminError (errorComponent роуту /admin)', () => {
  beforeEach(() => vi.mocked(reloadOnceForStaleChunk).mockClear());
  afterEach(cleanup);

  it('застарілий чанк → один reload і нейтральний стан, не екран помилки', () => {
    const error = new TypeError(
      'Failed to fetch dynamically imported module: /assets/page-OLD.js',
    );
    renderAdminError(error);

    expect(reloadOnceForStaleChunk).toHaveBeenCalledTimes(1);
    expect(reloadOnceForStaleChunk).toHaveBeenCalledWith(error);
    expect(screen.getByText('Оновлюємо сторінку…')).toBeTruthy();
    expect(screen.queryByText(error.message)).toBeNull();
  });

  it('застарілий чанк, але reload відмовив (уже пробували) → звичайний екран помилки', () => {
    vi.mocked(reloadOnceForStaleChunk).mockReturnValueOnce(false);
    const error = new TypeError('Importing a module script failed.');
    renderAdminError(error);

    expect(screen.getByText(error.message)).toBeTruthy();
    expect(screen.queryByText('Оновлюємо сторінку…')).toBeNull();
  });

  it('не-чанк помилка → звичайний екран, reload не викликано', () => {
    renderAdminError(toClientError('Error', 'x'));

    expect(screen.getByText('x')).toBeTruthy();
    expect(reloadOnceForStaleChunk).not.toHaveBeenCalled();
  });

  it('InsecureContextError → перекладений рядок з каталогу', () => {
    renderAdminError(
      toClientError(
        'InsecureContextError',
        '[simplycms/admin] Secure context required (https:// or localhost): crypto.randomUUID is unavailable.',
      ),
    );

    expect(
      screen.getByText(
        'Адмінка працює лише в захищеному контексті (https:// або localhost).',
      ),
    ).toBeTruthy();
  });

  it('довільна помилка → error.message дослівно (як кореневий ErrorBoundary)', () => {
    renderAdminError(toClientError('Error', 'x'));

    expect(screen.getByText('x')).toBeTruthy();
  });
});
