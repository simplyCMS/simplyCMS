// Фікстури доказу оновлюваності 1.0 (Task 14): тіло замовлення і підготовка
// магазину з даними. Окремо від тесту, щоб файл кейсів лишався читабельним.
import type { PlaceOrderInput } from 'simplycms/contracts';
import { applyCanon, applySqlFiles, queryRows } from '../../apply.mjs';
import { join } from 'node:path';

const DEMO = join(
  import.meta.dirname,
  '../../../../migrations/demo/demo-seed.sql',
);

export const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1,
]);

export const order = (items: PlaceOrderInput['items']): PlaceOrderInput => ({
  firstName: 'Тест',
  lastName: 'Покупець',
  email: 'upgrade@example.test',
  phone: '+380000000000',
  shippingMethodId: '',
  deliveryCity: null,
  deliveryAddress: null,
  pickupPointId: null,
  paymentMethod: 'cash',
  notes: null,
  hasDifferentRecipient: false,
  recipientFirstName: null,
  recipientLastName: null,
  recipientPhone: null,
  recipientEmail: null,
  recipientCity: null,
  recipientAddress: null,
  recipientNotes: null,
  saveRecipient: false,
  savedRecipientId: null,
  savedAddressId: null,
  items,
});

/** Канон + демо-сід + покупець; повертає ідентифікатори для самонакладу замовлення. */
export async function seedStore(dbUrl: string) {
  await applyCanon(dbUrl);
  await applySqlFiles(dbUrl, [DEMO]);
  const id = async (sql: string) =>
    ((await queryRows(dbUrl, sql)) as { id: string }[])[0]!.id;
  const pickup = await id(
    `select id from public.shipping_methods where code = 'pickup'`,
  );
  const point = await id(
    `select id from public.pickup_points where name = 'Склад у Києві'`,
  );
  const product = await id(
    `select id from public.products where slug = 'invertor-gibrydnyi-8kw'`,
  );
  await queryRows(
    dbUrl,
    `insert into public.users (id, name, email, email_verified)
     values (gen_random_uuid(), 'Покупець', 'buyer-upgrade@example.test', true)`,
  );
  return { pickup, point, product };
}
