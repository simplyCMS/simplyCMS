// Фікстури харнесу видалення акаунта (К3-Е6г, Task 7): БД редагування
// позицій + тимчасовий `MEDIA_ROOT`, покупець з усім графом залежних рядків
// і хелпери стану. `MEDIA_ROOT` ставиться ДО першого `getMediaDriver()`:
// драйвер мемоізований (`storage/local-fs.ts`).
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll } from 'vitest';
import { findOrphans } from './orphans';
import { useOrderItemsEditDb } from './order-items-edit';

export const ADMIN_ID = 'a0000000-0000-4000-8000-00000000e6a7';

/** Тимчасовий `MEDIA_ROOT` (поза хуком — лінт `react-hooks/immutability`). */
function mountMediaRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'simplycms-e6g-media-'));
  process.env.MEDIA_ROOT = root;
  return root;
}
function unmountMediaRoot(root: string): void {
  rmSync(root, { recursive: true, force: true });
  delete process.env.MEDIA_ROOT;
}

export function useDeleteDb(prefix: string) {
  const state = { root: '' };
  beforeAll(() => {
    state.root = mountMediaRoot();
  });
  afterAll(() => unmountMediaRoot(state.root));
  const base = useOrderItemsEditDb(prefix);
  const one = async <T>(text: string, p: unknown[] = []) =>
    (await base.rows<T>(text, p))[0]!;
  const f = {
    ...base,
    one,
    id: async (text: string, p: unknown[]) =>
      (await one<{ id: string }>(text, p)).id,
  };

  const hasFile = (ref: string) => existsSync(join(state.root, ref));
  const mediaRows = (ref: string) =>
    f.rows<{ id: string }>(
      `select id from public.media where storage_key = $1`,
      [ref],
    );

  /** Покупець із графом: профіль, адреса, історія, сесія, токен скидання. */
  const seedBuyer = async (o: { avatar?: boolean } = {}) => {
    const userId = crypto.randomUUID();
    const email = `e6g-${userId.slice(0, 8)}@example.test`;
    await f.rows(
      `insert into public.users (id, name, email, email_verified) values ($1, 'Видаляний', $2, true)`,
      [userId, email],
    );
    let avatar: string | null = null;
    if (o.avatar) {
      const u = crypto.randomUUID();
      avatar = `${u.slice(0, 2)}/${u}.webp`;
      await mkdir(dirname(join(state.root, avatar)), { recursive: true });
      await writeFile(join(state.root, avatar), 'x');
      await f.rows(
        `insert into public.media (id, entity_type, entity_id, storage_key, size_bytes, mime_type, uploaded_by)
         values (gen_random_uuid(), 'avatar', $1, $2, 1, 'image/webp', $1)`,
        [userId, avatar],
      );
    }
    await f.rows(
      `insert into public.profiles (id, user_id, email, avatar_url) values (gen_random_uuid(), $1, $2, $3)`,
      [userId, email, avatar],
    );
    await f.rows(
      `insert into public.user_addresses (id, user_id, name, city, address)
       values (gen_random_uuid(), $1, 'Дім', 'Київ', 'вул. 1')`,
      [userId],
    );
    await f.rows(
      `insert into public.sessions (id, user_id, token, expires_at)
       values (gen_random_uuid(), $1, $2, now() + interval '1 day')`,
      [userId, crypto.randomUUID()],
    );
    await f.rows(
      `insert into public.verifications (id, identifier, value, expires_at)
       values (gen_random_uuid(), $1, $2, now() + interval '1 day')`,
      [`reset-password:${crypto.randomUUID()}`, userId],
    );
    // Власний рядок історії покупця й чужий, де він лише `changed_by`.
    const other = crypto.randomUUID();
    await f.rows(
      `insert into public.users (id, name, email) values ($1, 'Інший', $2)`,
      [other, `other-${other.slice(0, 8)}@example.test`],
    );
    await f.rows(
      `insert into public.user_category_history (id, user_id, changed_by, to_category_id, to_category_name)
       select gen_random_uuid(), u, c, (select id from public.user_categories where is_default limit 1), 'X'
         from (values ($1::uuid, null::uuid), ($2::uuid, $1::uuid)) v(u, c)`,
      [userId, other],
    );
    return { userId, email, avatar, other };
  };

  const orphans = () => findOrphans((sql) => f.rows(sql));

  /** Три замовлення: адреса, точка видачі, зіпсований `{}` (Review Focus 2). */
  const placeThree = async (userId: string) => {
    const address = await f.place([{ productId: f.ids.panel, quantity: 2 }], {
      method: 'courier',
      userId,
    });
    const point = await f.place([{ productId: f.ids.battery, quantity: 1 }], {
      userId,
    });
    const broken = await f.place([{ productId: f.ids.battery, quantity: 1 }], {
      userId,
    });
    await f.rows(
      `update public.orders set shipping_data = '{}' where id = $1`,
      [broken],
    );
    return { address, point, broken };
  };

  const count = async (table: string, where: string, p: unknown[]) =>
    Number(
      (
        await f.one<{ n: string }>(
          `select count(*) as n from public.${table} where ${where}`,
          p,
        )
      ).n,
    );
  const userExists = async (userId: string) =>
    (await count('users', 'id = $1', [userId])) === 1;

  return {
    f,
    state,
    hasFile,
    mediaRows,
    seedBuyer,
    placeThree,
    count,
    userExists,
    orphans,
  };
}
