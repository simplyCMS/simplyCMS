// Доменні об'єкти замовлень.

import type { PageQuery } from "./common";

export interface OrderItem {
  productId: string;
  modificationId: string | null;
  name: string;
  quantity: number;
  price: number;
}

export interface OrderCustomer {
  name: string;
  email: string | null;
  phone: string;
}

export interface Order {
  id: string;
  number: string;
  status: string;
  customer: OrderCustomer;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  total: number;
  shipping: {
    methodId: string;
    rateId: string | null;
    pickupPointId: string | null;
    city: string | null;
    address: string | null;
  } | null;
  comment: string | null;
  userId: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateOrderInput {
  customer: OrderCustomer;
  items: OrderItem[];
  shipping?: Order["shipping"];
  comment?: string | null;
  userId?: string | null;
}

export interface OrderQuery extends PageQuery {
  status?: string;
  userId?: string;
  search?: string;
}
