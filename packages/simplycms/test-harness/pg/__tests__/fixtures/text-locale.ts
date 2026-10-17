// Мова читання тексту товару для тестів лоадерів і ціноутворення (М1, Task 16): основна
// `uk` і запит англійською. Лоадери беруть її обов'язковим параметром — явно, без дефолту.
import type { TextLocale } from 'simplycms/domain/translations';

export const UK: TextLocale = { locale: 'uk', primary: 'uk' };
export const EN: TextLocale = { locale: 'en', primary: 'uk' };
