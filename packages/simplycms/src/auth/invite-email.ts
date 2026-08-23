/**
 * Рендер листа-запрошення власника (Task 7, В2-К1а).
 *
 * 🔴 Виділено чистою функцією саме тому, що ДОСТАВКА недосяжна: SMTP у цьому
 * оточенні немає, лист шле колбек магазину. Рендер же — єдина частина, яку
 * можна довести машинно, і вона доводиться юнітом: посилання ціле, токен не
 * загубився, HTML-версія не ламається на лапках в імені магазину.
 */

/** Готовий лист — те, що колбек магазину віддає своєму транспорту. */
export interface InviteEmail {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

/** Колбек доставки. Реалізує магазин; ядро транспорту не знає. */
export type SendInviteEmail = (message: InviteEmail) => Promise<void>;

/** Мінімальне екранування — лист збирається конкатенацією, не шаблонізатором. */
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Скільки годин лишилось жити токену — для тексту листа. */
const hours = (ttlMs: number): number =>
  Math.max(1, Math.round(ttlMs / 3_600_000));

export interface InviteEmailInput {
  readonly to: string;
  readonly url: string;
  readonly storeName: string;
  readonly ttlMs: number;
}

/** Збирає лист. Мова — українська: це лист власнику магазину, не UI-рядок. */
export function renderInviteEmail(input: InviteEmailInput): InviteEmail {
  const ttl = hours(input.ttlMs);
  const subject = `Запрошення власника — ${input.storeName}`;
  const text =
    `Вас запрошено власником магазину «${input.storeName}».\n\n` +
    `Щоб задати пароль і увійти, відкрийте посилання:\n${input.url}\n\n` +
    `Посилання одноразове й дійсне ${ttl} год. Якщо ви не чекали цього ` +
    `листа — просто проігноруйте його.`;
  const html =
    `<p>Вас запрошено власником магазину «${escapeHtml(input.storeName)}».</p>` +
    `<p><a href="${escapeHtml(input.url)}">Задати пароль і увійти</a></p>` +
    `<p>Посилання одноразове й дійсне ${ttl} год.</p>`;

  return { to: input.to, subject, text, html };
}
