import type { ContentLocale, UiLocale } from 'simplycms/contracts';
import {
  loadTranslator,
  resolveUiLocale,
  toUiLocale,
  type Translator,
} from 'simplycms/i18n';

/**
 * Одержувач листа — те, з чого визначається мова ІНТЕРФЕЙСУ листа (спека §19.9). Чотири
 * різновиди, бо мову кожного листа визначає свій власник: замовлення, профіль, магазин.
 */
export type MailRecipient =
  /** Лист покупцю: мова замовлення (опублікована мова чекауту, Д9). */
  | { kind: 'order-customer'; orderLocale: ContentLocale }
  /** Лист користувачу (скидання пароля, підтвердження): вибір у профілі, інакше мова контенту. */
  | { kind: 'user'; uiLocale: string | null; locale: ContentLocale | null }
  /** Лист власнику магазину (про нове замовлення): основна мова магазину. */
  | { kind: 'store' }
  /** Запрошення: адресат ще не має профілю, тож основна мова магазину. */
  | { kind: 'invitee' };

/**
 * Мова листа за одержувачем. Одна функція на всі листи: fallback на основну мову живе
 * лише тут. Він і є деградований режим (§19.15): замовлення чи профіль мовою, що втратила
 * пакет (платформа його прибрала), отримує лист мовою магазину, а не падіння.
 *
 * `user.uiLocale` береться лише ТОЧНИМ кодом пакета з частинами `base` і `mail`
 * (`toUiLocale`): збережене значення, чий пакет зник, не має мовчки пройти як мова листа.
 */
export function resolveMailUiLocale(
  recipient: MailRecipient,
  primary: ContentLocale,
): UiLocale {
  switch (recipient.kind) {
    case 'order-customer':
      return resolveUiLocale(recipient.orderLocale, primary);
    case 'user':
      return (
        toUiLocale(recipient.uiLocale) ??
        resolveUiLocale(recipient.locale ?? primary, primary)
      );
    case 'store':
    case 'invitee':
      return resolveUiLocale(primary, primary);
  }
}

/** Транслятор листа: частини `base` і `mail` мови одержувача (частини ледачі, тож `await`). */
export function loadMailTranslator(
  recipient: MailRecipient,
  primary: ContentLocale,
): Promise<Translator> {
  return loadTranslator(resolveMailUiLocale(recipient, primary), [
    'base',
    'mail',
  ]);
}
