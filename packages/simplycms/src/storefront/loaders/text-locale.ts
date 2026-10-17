import type { TextLocale } from 'simplycms/domain/translations';
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
  const locale =
    requested !== undefined && set.published.includes(requested)
      ? requested
      : set.primary;
  return { locale, primary: set.primary };
}
