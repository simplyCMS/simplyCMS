// Сід читань покупців і дашборду (К3-Е6г, Task 3): замовлення й власник без
// профілю напряму SQL-ем — повз guard, це сід, а не перевірка.
import { rows } from './customer-categories';

export const STATUS_NEW = '00000001-0000-4000-8000-000000000001';
export const STATUS_CANCELLED = '00000001-0000-4000-8000-000000000006';

/** Власник, створений CLI: лише `users` + `user_roles`, профілю немає. */
export async function seedOwner(url: string, createdAt?: string) {
  const id = crypto.randomUUID();
  await rows(
    url,
    `insert into public.users (id, name, email, created_at)
     values ($1, 'Власник', $2, coalesce($3::timestamptz, now()))`,
    [id, `owner-${id.slice(0, 8)}@example.test`, createdAt ?? null],
  );
  await rows(
    url,
    `insert into public.user_roles (id, user_id, role) values ($1, $2, 'admin')`,
    [crypto.randomUUID(), id],
  );
  return id;
}

let seq = 0;

/** Замовлення з керованими статусом, сумою, датою й власником. */
export async function seedOrder(
  url: string,
  o: {
    userId?: string | null;
    statusId: string | null;
    total: string;
    createdAt?: string;
    erased?: boolean;
  },
): Promise<string> {
  const id = crypto.randomUUID();
  const pd = o.erased
    ? [null, null, null, null]
    : ['Іван', 'Іванов', 'i@x.test', '+380'];
  await rows(
    url,
    `insert into public.orders (id, user_id, order_number, status_id, first_name, last_name,
        email, phone, payment_method, subtotal, total, created_at, personal_data_erased_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,'cash',$9,$9, coalesce($10::timestamptz, now()),
        case when $11::boolean then now() end)`,
    [
      id,
      o.userId ?? null,
      `E6G-${++seq}-${id.slice(0, 6)}`,
      o.statusId,
      ...pd,
      o.total,
      o.createdAt ?? null,
      o.erased ?? false,
    ],
  );
  return id;
}
