import { formatPrice } from 'simplycms/domain/money';
import type { Translator } from 'simplycms/i18n';
import type { MailMessage } from '../types';
import { escapeHtml, layout, linkParagraph, paragraph } from './layout';

/**
 * Чисті рендери листів про нове замовлення. Тексти — лише з каталогу `mail.*`.
 * Суми з валютою: `locale` і `currency` приходять ззовні (host декларує їх у
 * `src/server.ts`), форматує детермінований `formatPrice` — `Intl` у стилі
 * `currency` дає різні символи на різних версіях ICU.
 */

export type OrderMailItem = {
  name: string;
  quantity: number;
  /** Ціна за одиницю, число (уже серверна, з `priceItems`). */
  price: number;
};

/** Знімок замовлення для листа: те, що вже записано в БД, не вхід клієнта. */
export type OrderMailData = {
  id: string;
  orderNumber: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  deliveryCity: string | null;
  deliveryAddress: string | null;
  items: readonly OrderMailItem[];
  subtotal: number;
  shippingCost: number;
  total: number;
};

/** Локаль і валюта магазину для форматування сум. */
export type OrderMailMoney = { locale: string; currency: string };

export type OrderCustomerMailInput = OrderMailMoney & {
  /** Адреса покупця; викликач гарантує непорожню (Д2 — гілка без email не рендериться). */
  to: string;
  order: OrderMailData;
  storeName: string;
  t: Translator;
};

export type OrderOwnerMailInput = OrderMailMoney & {
  to: string;
  order: OrderMailData;
  storeName: string;
  /** Абсолютне посилання на замовлення в адмінці — лише з `siteUrl` (Р18в). */
  adminUrl: string;
  t: Translator;
};

const moneyOf =
  (cfg: OrderMailMoney) =>
  (value: number): string =>
    formatPrice(value, cfg, { minimumFractionDigits: 2 });

/** Рядки складу й підсумків: однакові для обох листів. */
function summary(order: OrderMailData, t: Translator, cfg: OrderMailMoney) {
  const money = moneyOf(cfg);
  const lines = order.items.map((item) =>
    t('mail.order.line', {
      name: item.name,
      quantity: item.quantity,
      total: money(item.price * item.quantity),
    }),
  );
  const totals = [
    t('mail.order.subtotal', { amount: money(order.subtotal) }),
    t('mail.order.shipping', { amount: money(order.shippingCost) }),
    t('mail.order.total', { amount: money(order.total) }),
  ];
  const text = `${lines.join('\n')}\n\n${totals.join('\n')}`;
  const html =
    `<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>` +
    totals.map((l) => paragraph(escapeHtml(l))).join('');
  return { text, html };
}

export function renderOrderCustomerMail(
  input: OrderCustomerMailInput,
): MailMessage {
  const { to, order, storeName, t } = input;
  const params = { storeName, orderNumber: order.orderNumber };
  const intro = t('mail.order.customer.intro', params);
  const { text, html } = summary(order, t, input);
  return {
    to,
    kind: 'order_customer',
    subject: t('mail.order.customer.subject', params),
    text: `${intro}\n\n${text}`,
    html: layout(storeName, paragraph(escapeHtml(intro)) + html),
  };
}

export function renderOrderOwnerMail(input: OrderOwnerMailInput): MailMessage {
  const { to, order, storeName, adminUrl, t } = input;
  const params = { storeName, orderNumber: order.orderNumber };
  const intro = t('mail.order.owner.intro', params);
  const customer = t('mail.order.owner.customer', {
    name: `${order.firstName} ${order.lastName}`.trim(),
    phone: order.phone,
    email: order.email || t('mail.order.owner.noEmail'),
  });
  const delivery = [order.deliveryCity, order.deliveryAddress]
    .filter((part): part is string => !!part)
    .join(', ');
  const deliveryLine = delivery
    ? t('mail.order.owner.delivery', { address: delivery })
    : '';
  const open = t('mail.order.owner.openLink');
  const { text, html } = summary(order, t, input);
  const head = [customer, deliveryLine].filter(Boolean);
  return {
    to,
    kind: 'order_owner',
    subject: t('mail.order.owner.subject', params),
    text: `${intro}\n\n${head.join('\n')}\n\n${text}\n\n${open}\n${adminUrl}`,
    html: layout(
      storeName,
      paragraph(escapeHtml(intro)) +
        head.map((l) => paragraph(escapeHtml(l))).join('') +
        html +
        linkParagraph(adminUrl, t('mail.order.owner.action')),
    ),
  };
}
