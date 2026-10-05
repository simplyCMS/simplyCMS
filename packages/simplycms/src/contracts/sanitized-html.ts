/**
 * Брендований тип «HTML, який пройшов серверну санітизацію».
 *
 * Це ЄДИНИЙ тип, який приймає `<RichHtml>` (`simplycms/ui/rich-html`), і
 * тип полів view-model-ів, що несуть розмітку (`simplycms/contracts/views`).
 * Тема не може передати в компонент сирий `string`: компілятор відхилить.
 *
 * 🔴 Створює значення ЛИШЕ `sanitizeRichHtml` (`simplycms/sanitize`,
 * server-only). Цей файл — T0 і навмисно не імпортує `sanitize-html`: тип
 * має бути доступний клієнтському коду й темам, а залежність — ні.
 * Бренд — `declare const` без значення в рантаймі, тож у бандл нічого не йде.
 */
declare const sanitizedHtmlBrand: unique symbol;

export type SanitizedHtml = string & { readonly [sanitizedHtmlBrand]: true };
