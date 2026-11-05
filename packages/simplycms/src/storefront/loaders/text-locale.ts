import { ValidationError } from 'simplycms/contracts/domain-errors';
import {
  checkedTextLocale,
  type TextLocale,
} from 'simplycms/domain/translations';
import { loadLocaleSet } from './languages';

/**
 * Мова читання тексту для запиту з клієнта: мова з входу, якщо вона `published`,
 * інакше основна — а не помилка.
 *
 * Серверна функція приймає мову від браузера, але довіряти їй не можна: невідома чи
 * неопублікована мова (чернетка, друкарська помилка, старий кеш) не має ні відкривати
 * чернетку, ні ламати сторінку — вона читається основною, як у `getModificationData`.
 * Набір мов — з кешу мов (покоління в БД), окремого походу в таблицю немає.
 */
export async function resolveTextLocale(
  requested: string | undefined,
): Promise<TextLocale> {
  const set = await loadLocaleSet();
  // `find` отримує мову з набору (вже `ContentLocale`), а не приводить рядок із входу.
  const locale = set.published.find((c) => c === requested) ?? set.primary;
  return checkedTextLocale(locale, set.primary);
}

/**
 * Мова ОФОРМЛЕННЯ замовлення: лише `published`, інакше ВІДМОВА (помилка валідації), а не
 * тихий fallback на основну. Читання (лістинги, квота) лишаються на `resolveTextLocale` —
 * там неправильна мова дає основну без шкоди; а оформлення пише ЗНІМОК `order_items.name`,
 * тож замовлення мовою, якої покупець не бачив, не оформлюється. Перевірка — на межі
 * (серверна функція), `loadCatalog` лише приймає вже перевірений `TextLocale`.
 */
export async function requirePublishedTextLocale(
  requested: string,
): Promise<TextLocale> {
  const set = await loadLocaleSet();
  const locale = set.published.find((c) => c === requested);
  if (locale === undefined)
    throw new ValidationError([{ path: ['locale'], code: 'invalid_value' }]);
  return checkedTextLocale(locale, set.primary);
}
