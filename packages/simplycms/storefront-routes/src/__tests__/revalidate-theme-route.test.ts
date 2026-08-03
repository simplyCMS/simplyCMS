import { describe, it, expect, vi } from 'vitest';

/**
 * Прив'язка обробника до роуту. Тест, який кличе `revalidateTheme()` напряму,
 * лишається зеленим, навіть якщо `server.handlers.POST` прибрати — ендпойнта
 * не існує, а сюїта цього не бачить. Тут перевіряється саме реєстрація:
 * HTTP-метод → та сама функція.
 *
 * 🔴 Другий інваріант — файл роуту експортує ЛИШЕ `Route`. Named export звідси
 * переживає стрипінг властивості `server` і тягне серверний Supabase-клієнт у
 * клієнтський бандл; Gate C пілота ловив саме це.
 *
 * Паритет URL «викликач ↔ файл роуту» — окремий гард `tests/api-url-parity`.
 */

vi.mock('@simplycms/storefront-routes/server/is-admin', () => ({
  checkIsAdmin: async () => false,
}));
vi.mock('@simplycms/storefront-routes/server/themes', () => ({
  invalidateThemeCache: () => {},
}));

import * as routeModule from '../../routes/api/revalidate-theme';
import { revalidateTheme } from '../server/revalidate-theme';

// `handlers` типізовано як «запис АБО фабрика» — у цьому роуті це запис.
const handlers = routeModule.Route.options.server?.handlers as unknown as
  Record<string, unknown> | undefined;

describe('роут /api/revalidate-theme', () => {
  it('POST зареєстровано на revalidateTheme', () => {
    expect(handlers?.POST).toBe(revalidateTheme);
  });

  it('інших методів роут не відкриває', () => {
    expect(Object.keys(handlers ?? {})).toEqual(['POST']);
  });

  it('файл роуту експортує лише Route — інакше серверний код тече в клієнт', () => {
    expect(Object.keys(routeModule)).toEqual(['Route']);
  });
});
