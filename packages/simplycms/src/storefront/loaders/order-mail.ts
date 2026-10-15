import type { PlaceOrderInput, PlacedOrder } from 'simplycms/contracts';
import { createTranslator, type Locale } from 'simplycms/i18n';
import {
  enqueueMail,
  renderOrderCustomerMail,
  renderOrderOwnerMail,
  type MailItem,
  type OrderMailData,
} from 'simplycms/mail';
import { readStoreProfile } from 'simplycms/site';
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
 * Усе, що лист бере з конфігурації, а не з БД. Збирається ДО транзакції
 * (`place-order.ts`): збій конфігурації (немає `VITE_SITE_URL`) відмовляє одразу,
 * а не відкочує вже виконану частину оформлення.
 */
export type OrderMailContext = {
  /** `siteUrl('/admin/orders/')` — id замовлення дописується вже в транзакції. */
  adminBase: string;
  locale: Locale;
  currency: string;
};

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
  ctx: OrderMailContext,
): Promise<string[]> {
  const profile = await readStoreProfile(odb);
  const ownerEmail = profile.contacts.email?.trim() ?? '';
  const to = customerEmail.trim();
  const storeName = profile.name || 'SimplyCMS';
  // М2: фолбек стане основною мовою магазину (лист іде мовою замовлення).
  const t = createTranslator(ctx.locale, 'uk');
  const money = { locale: ctx.locale, currency: ctx.currency };
  const items: MailItem[] = [];
  if (to)
    items.push({
      kind: 'order_customer',
      message: renderOrderCustomerMail({
        to,
        order: data,
        storeName,
        t,
        ...money,
      }),
    });
  if (ownerEmail)
    items.push({
      kind: 'order_owner',
      message: renderOrderOwnerMail({
        to: ownerEmail,
        order: data,
        storeName,
        // Р18(в): база посилання лише з `VITE_SITE_URL` (ctx), не з запиту.
        adminUrl: ctx.adminBase + data.id,
        t,
        ...money,
      }),
    });
  return enqueueMail(odb, items);
}
