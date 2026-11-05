// М2а Task 5 (І45): мова інтерфейсу адмінки в `profiles.ui_locale` проти живого Postgres.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AuthzError, readProfileUiLocale } from 'simplycms/auth';
import {
  AdminNotFoundError,
  ValidationError,
} from 'simplycms/contracts/domain-errors';
import { profilesSetUiLocale } from 'simplycms/admin-server/impl';
import { executeOperation } from 'simplycms/operations';
import type { OperationDef } from 'simplycms/operations';
import { ADMIN, useAddressingDb } from './fixtures/addressing-db';

// Тестовий реєстр: `de` — пакет без частини `admin` (§19.15).
vi.mock('../../../src/i18n/packs/registry', async (importOriginal) => {
  const { testPackRegistry } = await import('../../language-packs');
  const real =
    await importOriginal<typeof import('../../../src/i18n/packs/registry')>();
  return { PACKS: testPackRegistry(real.PACKS) };
});

const OTHER = '44444444-4444-4444-8444-444444444444';
const NO_PROFILE = '55555555-5555-4555-8555-555555555555';
const admin = { userId: ADMIN.userId, roles: ['admin' as const] };
const customer = { userId: OTHER, roles: ['user' as const] };

describe('мова інтерфейсу адмінки: profiles.ui_locale (І45)', () => {
  const db = useAddressingDb('simplycms_profile_ui_locale');
  const exec = async <I, O>(
    def: OperationDef<I, O>,
    raw: unknown,
    subject: { userId: string | null; roles: ('admin' | 'user')[] } = admin,
  ) => {
    const res = await executeOperation(def, raw, subject);
    if (res.replayed) throw new Error('replay');
    return res.output;
  };
  const stored = async (userId: string) =>
    (
      await db.q(`select ui_locale from public.profiles where user_id = $1`, [
        userId,
      ])
    )[0]?.ui_locale;

  /** Кожен кейс сам виставляє стартовий стан: порядок кейсів нічого не вирішує. */
  const seed = (userId: string, value: string | null) =>
    db.q(`update public.profiles set ui_locale = $2 where user_id = $1`, [
      userId,
      value,
    ]);

  beforeAll(async () => {
    for (const [id, email] of [
      [ADMIN.userId, 'a@example.test'],
      [OTHER, 'o@example.test'],
      [NO_PROFILE, 'n@example.test'],
    ] as const)
      await db.q(
        `insert into public.users (id, email, name) values ($1, $2, 'T')`,
        [id, email],
      );
    await db.q(
      `insert into public.profiles (id, user_id) values
         (gen_random_uuid(), $1), (gen_random_uuid(), $2)`,
      [ADMIN.userId, OTHER],
    );
  });

  it('адмін ставить en → збережено en', async () => {
    await seed(ADMIN.userId, null);
    await exec(profilesSetUiLocale, { uiLocale: 'en' });
    expect(await stored(ADMIN.userId)).toBe('en');
  });

  it('невідомий код → 400, рядок не змінено', async () => {
    await seed(ADMIN.userId, 'en');
    await expect(
      exec(profilesSetUiLocale, { uiLocale: 'xx' }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await stored(ADMIN.userId)).toBe('en');
  });

  it('пакет без частини admin → 400, рядок не змінено (§19.15)', async () => {
    await seed(ADMIN.userId, 'en');
    await expect(
      exec(profilesSetUiLocale, { uiLocale: 'de' }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await stored(ADMIN.userId)).toBe('en');
  });

  // Читання мови адмінки в сесії (`getAdminSession`, §19.6): власний рядок під app_user + RLS.
  it('readProfileUiLocale: збережена мова адміна → вона; без мови чи без профілю → null', async () => {
    await seed(ADMIN.userId, 'en');
    expect(await readProfileUiLocale(ADMIN.userId)).toBe('en');
    await seed(ADMIN.userId, null);
    expect(await readProfileUiLocale(ADMIN.userId)).toBeNull();
    expect(await readProfileUiLocale(NO_PROFILE)).toBeNull();
  });

  it('null скидає вибір', async () => {
    await seed(ADMIN.userId, 'en');
    await exec(profilesSetUiLocale, { uiLocale: null });
    expect(await stored(ADMIN.userId)).toBeNull();
  });

  it('пише лише власний рядок', async () => {
    await seed(ADMIN.userId, null);
    await seed(OTHER, 'uk');
    await exec(profilesSetUiLocale, { uiLocale: 'en' });
    expect(await stored(ADMIN.userId)).toBe('en');
    expect(await stored(OTHER)).toBe('uk');
  });

  it('роль user ставить свою мову (колонковий грант, Д7)', async () => {
    await seed(OTHER, 'uk');
    await exec(profilesSetUiLocale, { uiLocale: 'en' }, customer);
    expect(await stored(OTHER)).toBe('en');
  });

  it('профілю немає → AdminNotFoundError, рядок не створено (профіль — справа провізії)', async () => {
    await expect(
      exec(
        profilesSetUiLocale,
        { uiLocale: 'en' },
        {
          userId: NO_PROFILE,
          roles: ['admin'],
        },
      ),
    ).rejects.toBeInstanceOf(AdminNotFoundError);
    expect(await stored(NO_PROFILE)).toBeUndefined();
  });

  it('актор system → AdminNotFoundError, дані не чіпано', async () => {
    await seed(ADMIN.userId, 'en');
    const system = { userId: null, roles: ['admin' as const] };
    await expect(
      exec(profilesSetUiLocale, { uiLocale: null }, system),
    ).rejects.toBeInstanceOf(AdminNotFoundError);
    expect(await stored(ADMIN.userId)).toBe('en');
  });

  it('без ролі — AuthzError', async () => {
    await expect(
      exec(
        profilesSetUiLocale,
        { uiLocale: 'en' },
        { userId: ADMIN.userId, roles: [] },
      ),
    ).rejects.toBeInstanceOf(AuthzError);
  });
});
