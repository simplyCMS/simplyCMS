import { randomUUID } from 'node:crypto';
import type { PlaceOrderInput, PlaceOrderResult } from 'simplycms/contracts';
import { applyCategoryRules } from 'simplycms/commerce';
import { InsufficientStockError } from 'simplycms/inventory';
import { siteUrl } from 'simplycms/env';
import { deliverMail } from 'simplycms/mail';
import { getStoreCurrency, getStoreLocale } from 'simplycms/site';
import {
  withCustomerDb,
  withOrderTokenDb,
  withStoreOperatorDb,
  type ActorDb,
  type OperatorEscalation,
} from './db';
import { prepareCheckout } from './prepare-checkout';
import { createOrder } from './order-create';
import {
  enqueueOrderMails,
  toOrderMailData,
  type OrderMailContext,
} from './order-mail';
import { resolveRecipient, toOrderInput } from './place-order-support';

/**
 * Логіка оформлення без RPC-обгортки — щоб харнес доводив воронку напряму.
 *
 * 🔴 Живе в server-only дереві `storefront` (декларація межі), а не другим
 * експортом поруч із serverFn: у клієнтському модулі не-serverFn експорт
 * лишається живим і тягне лоадери в клієнтський граф — Import Protection
 * валить збірку магазину (той самий клас, що описано в `core/lib/discounts.ts`).
 *
 * 🔴 ОДНА транзакція на все: довідники, ціни, отримувач, запис. Дві
 * послідовні (спершу читання, потім запис) залишали б вікно, у якому ціна,
 * тариф чи залишок змінюються між ними (B3 аудиту r1). Відмови — значеннями
 * (до жодного запису), нестача залишку — винятком з відкатом усередині
 * `createOrder` (списання — під ескалацією, див. `escalationFor`).
 */
export async function placeOrderFor(
  input: PlaceOrderInput,
  userId: string | null,
): Promise<PlaceOrderResult> {
  // 🔴 Порожній кошик — `prepareCheckout` відмовляє ДО priceItems
  // (гвард живе там, спільний з квотою — рев'ю #9, докладніше в
  // `prepare-checkout.ts`), не тут: другий незалежний гвард на той самий
  // предикат — саме те дублювання, з яким весь розділ M бореться.
  // 🔴 Конфігурація листа — ДО транзакції: відсутній `VITE_SITE_URL` має
  // відмовити одразу (fail-loud, Р18), а не відкотити вже виконане оформлення.
  const mailContext: OrderMailContext = {
    adminBase: siteUrl('/admin/orders/', process.env),
    locale: getStoreLocale(),
    currency: getStoreCurrency(),
  };
  const accessToken = userId === null ? randomUUID() : null;
  const run = <T>(
    fn: (db: ActorDb, operator: OperatorEscalation) => Promise<T>,
  ): Promise<T> =>
    userId === null
      ? withOrderTokenDb(accessToken as string, fn)
      : withCustomerDb(userId, fn);

  let result: PlaceOrderResult;
  let mailIds: string[] = [];
  try {
    result = await run(async (db, operator) => {
      const prepared = await prepareCheckout(db, input, userId);
      if (!prepared.ok) return prepared;

      const savedRecipientId = await resolveRecipient(db, userId, input);
      const newOrder = toOrderInput(input, savedRecipientId, {
        items: prepared.items,
        subtotal: prepared.subtotal,
        shippingCost: prepared.shippingCost,
        total: prepared.total,
        shippingSnapshot: prepared.shippingSnapshot,
      });
      const order = await createOrder(
        db,
        userId,
        accessToken,
        newOrder,
        operator,
      );
      // 🔴 Листи — у ТІЙ САМІЙ транзакції (Е8-Р10): відкат прибирає й їх, а збій
      // запису листа відкочує замовлення. Ескалація, як `eraseMediaRows`.
      mailIds = await operator((odb) =>
        enqueueOrderMails(
          odb,
          toOrderMailData(order, newOrder),
          newOrder.email,
          mailContext,
        ),
      );
      return { ok: true, order } as const;
    });
  } catch (error) {
    if (error instanceof InsufficientStockError)
      return { ok: false, reason: 'not_purchasable' };
    throw error;
  }
  if (result.ok) {
    // Після COMMIT, для гостя і покупця; без `await`: затримка SMTP не має
    // гальмувати відповідь чекауту, а слід лишається в outbox (`deliverMail`
    // не кидає). `then` — щоб синхронний збій вибору транспорту (`getMailTransport`
    // у дефолтному аргументі) теж не ламав уже закомічене замовлення.
    void Promise.resolve()
      .then(() => deliverMail(mailIds))
      .catch((error: unknown) => {
        // Лише клас помилки: без адрес, тіла й посилань (як у auth/reset-mail); службовий лог англійською — i18n-зона вітрини кирилиці не пускає.
        console.warn(
          '[simplycms/storefront] background delivery of order emails failed:',
          error instanceof Error ? error.name : typeof error,
        );
      });
    if (userId !== null) await applyRulesAfterOrder(userId);
  }
  return result;
}

/**
 * Автоправила категорії покупця ПІСЛЯ COMMIT замовлення (Е6в-19) — в
 * ОКРЕМІЙ службовій транзакції: правила читають `accounts`/`users` і пишуть
 * `profiles.category_id`, що покупцю не дозволено (Е6в-24).
 *
 * 🔴 Збій правил (зламаний рядок, обрив зʼєднання) НЕ ламає оформлення:
 * замовлення вже закомічене й мусить повернутись покупцю. Помилка — лише в
 * `console.error`; категорію перерахує наступне замовлення або кнопка
 * «Запустити всі правила».
 */
async function applyRulesAfterOrder(userId: string): Promise<void> {
  try {
    await withStoreOperatorDb((db) => applyCategoryRules(db, userId));
  } catch (error) {
    // Службовий лог, не рядок інтерфейсу: i18n-зона вітрини кирилиці не пускає.
    console.error(
      '[simplycms/storefront] customer category rules were not applied after the order:',
      error,
    );
  }
}
