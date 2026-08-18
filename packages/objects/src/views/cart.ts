// View-model кошика (контракт тем v3). Склад — із фактичного JSX
// `pages/Cart.tsx`: дані сторінки зводяться до лічильника позицій, решта —
// прибінджені слоти (позиції, підсумок, перехід до оформлення).

import type { BreadcrumbItem } from './common';
import type { SlotComponent } from './slots';

export interface CartSlots {
  /** Список позицій кошика з керуванням кількістю й видаленням. */
  Items: SlotComponent;
  /** Кнопка «очистити кошик». */
  ClearCart: SlotComponent;
  /** Блок підсумку: сума позицій, доставка, разом. */
  Summary: SlotComponent;
  /** Перехід до оформлення замовлення. */
  Checkout: SlotComponent;
}

export interface CartViewModel {
  breadcrumbs: BreadcrumbItem[];
  /** Кількість позицій; `0` — порожній кошик (крайній стан conformance). */
  itemCount: number;
  slots: CartSlots;
}
