// Мова читання тексту товару для тестів лоадерів і ціноутворення (М1, Task 16): основна
// `uk` і запит англійською. Лоадери беруть її обов'язковим параметром — явно, без дефолту.
import { checkedTextLocale } from 'simplycms/domain/translations';
import { cl } from '../../../locale';

export const UK = checkedTextLocale(cl('uk'), cl('uk'));
export const EN = checkedTextLocale(cl('en'), cl('uk'));
