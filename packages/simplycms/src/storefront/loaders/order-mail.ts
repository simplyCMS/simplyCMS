import type { PlaceOrderInput, PlacedOrder } from 'simplycms/contracts';
import { siteUrl } from 'simplycms/env';
import { createTranslator } from 'simplycms/i18n';
import {
  enqueueMail,
  renderOrderCustomerMail,
  renderOrderOwnerMail,
  type MailItem,
  type OrderMailData,
} from 'simplycms/mail';
import { getStoreLocale, readStoreProfile } from 'simplycms/site';
import type { ActorDb } from './db';
import type { NewOrderInput } from './entities/new-order';

/** Знімок для листа з того, що ЩОЙНО записано (серверні ціни), не з вводу клієнта. */
export function toOrderMailData(
  order: PlacedOrder,
  saved: NewOrderInput,
): OrderMailData {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    firstName: saved.firstName,
    lastName: saved.lastName,
    phone: saved.phone,
    email: saved.email,
    deliveryCity: saved.deliveryCity,
    deliveryAddress: saved.deliveryAddress,
    items: saved.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      price: i.price,
    })),
    subtotal: saved.subtotal,
    shippingCost: saved.shippingCost,
    total: saved.total,
  };
}

/**
 * Листи замовлення в outbox — у ТІЙ САМІЙ транзакції, що й `createOrder`
 * (Е8-Р10): відкат замовлення прибирає й листи, а збій запису листа відкочує
 * замовлення. Викликається під ескалацією `operator` (`app_admin`): покупець
 * не має прав ні на `mail_outbox`, ні на `system_settings`.
 *
 * 🔴 Д2: чекаут законно приймає замовлення лише з телефоном (`email: ''`) —
 * тоді листа покупцю немає ні в outbox, ні в транспорті, і це не помилка.
 * Лист власнику — лише якщо в профілі магазину задано контактний email.
 * Повертає id рядків для `deliverMail` ПІСЛЯ COMMIT.
 */
export async function enqueueOrderMails(
  odb: ActorDb,
  data: OrderMailData,
  customerEmail: PlaceOrderInput['email'],
): Promise<string[]> {
  const profile = await readStoreProfile(odb);
  const ownerEmail = profile.contacts.email?.trim() ?? '';
  const to = customerEmail.trim();
  const storeName = profile.name || 'SimplyCMS';
  const t = createTranslator(getStoreLocale());
  const items: MailItem[] = [];
  if (to)
    items.push({
      kind: 'order_customer',
      message: renderOrderCustomerMail({ to, order: data, storeName, t }),
    });
  if (ownerEmail)
    items.push({
      kind: 'order_owner',
      message: renderOrderOwnerMail({
        to: ownerEmail,
        order: data,
        storeName,
        // Р18(в): посилання лише з `VITE_SITE_URL`, не з запиту.
        adminUrl: siteUrl(`/admin/orders/${data.id}`, process.env),
        t,
      }),
    });
  return enqueueMail(odb, items);
}
