import { z } from 'zod';
import { LANGUAGE_CODE_FORMAT } from 'simplycms/domain/translations';

/**
 * ЄДИНА схема `locale` у входах серверних функцій вітрини (М1, Task 16): код мови форми BCP 47,
 * як у реєстрі мов, з межею довжини. Чи мова опублікована, перевіряє серверний
 * `resolveTextLocale` (читання) / `requirePublishedTextLocale` (оформлення).
 */
export const localeInput = z.string().max(35).regex(LANGUAGE_CODE_FORMAT);

/** Об'єктна форма `{ locale }` для функцій, що більше нічого не приймають. */
export const localeOnlyInput = z.object({ locale: localeInput });
