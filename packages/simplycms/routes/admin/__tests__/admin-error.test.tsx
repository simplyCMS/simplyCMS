// @vitest-environment jsdom
import type { ComponentType, ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
