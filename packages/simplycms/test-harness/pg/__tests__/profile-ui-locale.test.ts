// М2а Task 5 (І45): мова інтерфейсу адмінки в `profiles.ui_locale` проти живого Postgres.
import { beforeAll, describe, expect, it } from 'vitest';
import { AuthzError } from 'simplycms/auth';
import { ValidationError } from 'simplycms/contracts/domain-errors';
import {
  profilesGetUiLocale,
  profilesSetUiLocale,
} from 'simplycms/admin-server/impl';
import { executeOperation } from 'simplycms/operations';
import type { OperationDef } from 'simplycms/operations';
import { ADMIN, useAddressingDb } from './fixtures/addressing-db';

const OTHER = '44444444-4444-4444-8444-444444444444';
const admin = { userId: ADMIN.userId, roles: ['admin' as const] };

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

  beforeAll(async () => {
    for (const [id, email] of [
      [ADMIN.userId, 'a@example.test'],
      [OTHER, 'o@example.test'],
    ] as const)
      await db.q(
        `insert into public.users (id, email, name) values ($1, $2, 'T')`,
        [id, email],
      );
    await db.q(
      `insert into public.profiles (id, user_id, ui_locale) values
         (gen_random_uuid(), $1, null), (gen_random_uuid(), $2, 'uk')`,
      [ADMIN.userId, OTHER],
    );
  });

  it('адмін ставить en → getUiLocale повертає en', async () => {
    await exec(profilesSetUiLocale, { uiLocale: 'en' });
    expect(await exec(profilesGetUiLocale, {})).toEqual({ uiLocale: 'en' });
  });

  it('невідомий код → 400, рядок не змінено', async () => {
    await expect(
      exec(profilesSetUiLocale, { uiLocale: 'xx' }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await stored(ADMIN.userId)).toBe('en');
  });

  it('null скидає вибір', async () => {
    await exec(profilesSetUiLocale, { uiLocale: null });
    expect(await stored(ADMIN.userId)).toBeNull();
    expect(await exec(profilesGetUiLocale, {})).toEqual({ uiLocale: null });
  });

  it('пише лише власний рядок', async () => {
    await exec(profilesSetUiLocale, { uiLocale: 'en' });
    expect(await stored(OTHER)).toBe('uk');
  });

  it('актор system → відмова, дані не чіпано', async () => {
    const system = { userId: null, roles: ['admin' as const] };
    await expect(
      exec(profilesSetUiLocale, { uiLocale: null }, system),
    ).rejects.toThrow();
    await expect(exec(profilesGetUiLocale, {}, system)).rejects.toThrow();
    expect(await stored(ADMIN.userId)).toBe('en');
  });

  it('без ролі — AuthzError', async () => {
    await expect(
      exec(profilesGetUiLocale, {}, { userId: ADMIN.userId, roles: [] }),
    ).rejects.toBeInstanceOf(AuthzError);
  });
});
