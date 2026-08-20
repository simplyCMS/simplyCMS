// Реквізити кошика (контракт тем v3, Фаза 5).
//
// 🔴 На відміну від ProductDetail/Catalog, реквізити кошика самодостатні:
// самі читають `useCart()` (Ф2), тому прив'язок контекстом тут не потрібно
// — сталий обʼєкт одразу підходить під `CartSlots`.

import type { CartSlots } from 'simplycms/contracts/views';
import {
  CartCheckoutButton,
  CartClearButton,
  CartItemsList,
} from '../../views/slots/CartSlots';
import { CartSummary } from '../../views/slots/CartSummary';

export const cartSlots: CartSlots = {
  Items: CartItemsList,
  ClearCart: CartClearButton,
  Summary: CartSummary,
  Checkout: CartCheckoutButton,
};
