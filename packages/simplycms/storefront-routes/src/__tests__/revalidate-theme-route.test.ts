import { describe, it, expect, vi } from 'vitest';

/**
 * Прив'язка обробника до роуту. Тест, який кличе `revalidateThemeHandler()`
 * напряму, лишається зеленим, навіть якщо `server.handlers.POST` прибрати —
 * ендпойнта не існує, а сюїта цього не бачить. Тут перевіряється саме
 * реєстрація: HTTP-метод → та сама функція.
 *
 * Паритет URL «викликач ↔ файл роуту» — окремий гард `tests/api-url-parity`.
 */

vi.mock('@simplycms/storefront-routes/server/auth', () => ({
  checkIsAdmin: async () => false,
}));
vi.mock('@simplycms/storefront-routes/server/themes', () => ({
  invalidateThemeCache: () => {},
}));

import {
  Route,
  revalidateThemeHandler,
} from '../../routes/api/revalidate-theme';

// `handlers` типізовано як «запис АБО фабрика» — у цьому роуті це запис.
const handlers = Route.options.server?.handlers as unknown as
  Record<string, unknown> | undefined;

describe('роут /api/revalidate-theme', () => {
  it('POST зареєстровано на revalidateThemeHandler', () => {
    expect(handlers?.POST).toBe(revalidateThemeHandler);
  });

  it('інших методів роут не відкриває', () => {
    expect(Object.keys(handlers ?? {})).toEqual(['POST']);
  });
});
