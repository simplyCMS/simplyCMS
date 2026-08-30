import { randomUUID } from 'node:crypto';
import { createServerFn } from '@tanstack/react-start';
import {
  createOrder,
  createRecipient,
  withCustomerDb,
  withOrderTokenDb,
  type ActorDb,
  type NewOrderInput,
  optionalSessionUserId,
} from 'simplycms/storefront/loaders';
import {
  checkoutInputSchema,
  type CheckoutInput,
  type PlacedOrder,
} from './checkout-input';

/**
 * Оформлення замовлення.
 *
 * 🔴 Замовлення й позиції створюються в ОДНІЙ транзакції актора. Раніше це
 * були два незалежні запити браузера: падіння другого лишало в базі
 * замовлення без жодної позиції, і ніщо його звідти не прибирало.
 *
 * 🔴 Гість дістає `access_token`, і цей самий токен виставляється в GUC
 * `app.order_token` ТІЄЇ Ж транзакції. `withOrderTokenDb` тут не рудимент від
 * знятого `returning`: без токена падає вставка ПОЗИЦІЙ. `order_items_insert_own`
 * перевіряє `exists (select 1 from orders where orders.id = order_items.order_id …)`,
 * підзапит іде під тим самим актором і підпадає під RLS `orders`, а гостьовий
 * рядок (`user_id is null`) видно лише гілці
 * `access_token = current_setting('app.order_token')` політики
 * `orders_select_own_or_token`.
 */
export const placeOrder = createServerFn({ method: 'POST' })
  .inputValidator(checkoutInputSchema)
  .handler(async ({ data }): Promise<PlacedOrder> => {
    const input = data as CheckoutInput;
    const userId = await optionalSessionUserId();
    const accessToken = userId === null ? randomUUID() : null;

    const run = <T>(fn: (db: ActorDb) => Promise<T>): Promise<T> =>
      userId === null
        ? withOrderTokenDb(accessToken as string, fn)
        : withCustomerDb(userId, fn);

    return run(async (db) => {
      const savedRecipientId = await resolveRecipient(db, userId, input);
      return createOrder(
        db,
        userId,
        accessToken,
        toOrderInput(input, savedRecipientId),
      );
    });
  });

/**
 * Отримувач замовлення: обраний зі списку, новий (зі збереженням) або жоден.
 *
 * Гість книги отримувачів не має — для нього завжди `null`.
 */
async function resolveRecipient(
  db: ActorDb,
  userId: string | null,
  input: CheckoutInput,
): Promise<string | null> {
  if (input.savedRecipientId) return input.savedRecipientId;
  if (!userId || !input.hasDifferentRecipient || !input.saveRecipient) {
    return null;
  }
  if (!input.recipientFirstName || !input.recipientLastName) return null;
  if (!input.recipientPhone || !input.recipientCity) return null;
  if (!input.recipientAddress) return null;

  return createRecipient(db, userId, {
    firstName: input.recipientFirstName,
    lastName: input.recipientLastName,
    phone: input.recipientPhone,
    email: input.recipientEmail,
    city: input.recipientCity,
    address: input.recipientAddress,
    notes: input.recipientNotes,
  });
}

/**
 * Форма запиту → форма вставки.
 *
 * 🔴 Суми рахуються ТУТ, а не приймаються з клієнта. Ціни позицій поки що
 * приходять з кошика (перерахунок прайсу й знижок на сервері — окремий крок),
 * але «сума не збігається з позиціями» більше неможлива за побудовою.
 */
function toOrderInput(
  input: CheckoutInput,
  savedRecipientId: string | null,
): NewOrderInput {
  const subtotal = input.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  return {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    shippingMethodId: input.shippingMethodId,
    deliveryCity: input.deliveryCity,
    deliveryAddress: input.deliveryAddress,
    pickupPointId: input.pickupPointId,
    paymentMethod: input.paymentMethod,
    notes: input.notes,
    subtotal,
    shippingCost: input.shippingCost,
    total: subtotal + input.shippingCost,
    hasDifferentRecipient: input.hasDifferentRecipient,
    recipientFirstName: input.hasDifferentRecipient
      ? input.recipientFirstName
      : null,
    recipientLastName: input.hasDifferentRecipient
      ? input.recipientLastName
      : null,
    recipientPhone: input.hasDifferentRecipient ? input.recipientPhone : null,
    recipientEmail: input.hasDifferentRecipient ? input.recipientEmail : null,
    savedRecipientId,
    savedAddressId: input.savedAddressId,
    items: input.items.map((item) => ({
      productId: item.productId,
      modificationId: item.modificationId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      basePrice: item.basePrice,
      discountData: item.discountData ?? null,
    })),
  };
}
