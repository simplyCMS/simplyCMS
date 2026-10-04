import { describe, expect, it, vi } from 'vitest';

// Е5б Task 8 (C): гварди конфігу фабрики — `touch` не може бути прихованою
// колонкою (тип), `maxLimit` — лише додатне ціле (fail-loud на старті).
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: 'u1', roles: ['admin'] },
    scope: 'any',
  })),
}));
vi.mock('simplycms/db', () => ({
  withActor: vi.fn(async (_actor, fn) => fn({} as never, {} as never)),
}));

import { defineAdminResource } from '../resource';
import { ordersConfig } from './orders-config';

const base = { ...ordersConfig, omit: ['accessToken'] as const };

describe('maxLimit — валідація на старті фабрики', () => {
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'maxLimit = %s → Error ще до першого запиту',
    (maxLimit) => {
      expect(() => defineAdminResource({ ...base, maxLimit })).toThrow(
        `[admin-server] ${ordersConfig.entity}: maxLimit має бути додатним цілим, отримано ${String(maxLimit)}`,
      );
    },
  );

  it('додатне ціле і відсутній maxLimit — валідні', () => {
    expect(defineAdminResource({ ...base, maxLimit: 1 }).maxLimit).toBe(1);
    expect(defineAdminResource(base).maxLimit).toBeUndefined();
  });
});

// 🔴 Це гейт `pnpm typecheck`, а не vitest: vitest типів не перевіряє, тож
// тіло нижче зелене за будь-якого типу `touch`. Доводить його TS2578
// («Unused '@ts-expect-error' directive») — якщо тип знову пропустить
// приховану колонку, директива стане зайвою й `tsc` упаде. Рантайм-виклик
// лишено, щоб файл тримав і позитивний контроль (видима колонка валідна).
describe('touch — лише видима колонка (гейт typecheck)', () => {
  it('прихована (omit) колонка як touch — помилка типу (ловить tsc TS2578, не vitest)', () => {
    // Колонка з omit не входить ні в RETURNING, ні в тип рядка — штамп
    // `touch` писав би секрет повз видимий контракт ресурсу.
    defineAdminResource({
      ...base,
      // @ts-expect-error — accessToken прихований, touch ним бути не може
      touch: 'accessToken',
    });
    // Позитивний контроль: видима колонка — валідна.
    defineAdminResource({ ...base, touch: 'updatedAt' });
  });
});
