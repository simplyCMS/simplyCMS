// Мова читання тексту товару для тестів лоадерів і ціноутворення (М1, Task 16): основна
// `uk` і запит англійською. Лоадери беруть її обов'язковим параметром — явно, без дефолту.
import { checkedTextLocale } from 'simplycms/domain/translations';

export const UK = checkedTextLocale('uk', 'uk');
export const EN = checkedTextLocale('en', 'uk');
