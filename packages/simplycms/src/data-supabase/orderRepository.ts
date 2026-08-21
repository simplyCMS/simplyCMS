// Supabase-реалізація OrderRepository (DI client + scope).

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  OrderRepository,
  ScopeResolver,
  Order,
  OrderQuery,
  CreateOrderInput,
  Paged,
} from 'simplycms/contracts';
import { mapOrder } from './mappers';
import { singleTenantScope, SCOPE_COLUMN } from './scope';

const ORDER_SELECT = '*, order_statuses(id, name, color, code), order_items(*)';

type Row = Record<string, unknown>;

export function createSupabaseOrderRepository(
  client: SupabaseClient,
  scope: ScopeResolver = singleTenantScope,
): OrderRepository {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scoped = (query: any) => {
    const hubId = scope.getScope();
    return hubId === undefined ? query : query.eq(SCOPE_COLUMN, hubId);
  };

  async function resolveStatusId(status: string): Promise<string | null> {
    const { data } = await client
      .from('order_statuses')
      .select('id')
      .or(`code.eq.${status},name.eq.${status}`)
      .maybeSingle();
    return data ? String((data as Row).id) : null;
  }

  return {
    async createOrder(input: CreateOrderInput): Promise<Order> {
      const subtotal = input.items.reduce(
        (sum, it) => sum + it.price * it.quantity,
        0,
      );
      const shippingCost = input.shippingCost ?? 0;
      const [firstName, ...rest] = input.customer.name.split(' ');
      const insert: Row = {
        user_id: input.userId ?? null,
        order_number: `${Date.now()}`,
        first_name: firstName ?? '',
        last_name: rest.join(' '),
        // orders.email/payment_method — NOT NULL у схемі.
        email: input.customer.email ?? '',
        phone: input.customer.phone,
        payment_method: input.paymentMethod ?? 'cash',
        notes: input.comment ?? null,
        subtotal,
        shipping_cost: shippingCost,
        total: subtotal + shippingCost,
        shipping_method_id: input.shipping?.methodId ?? null,
        shipping_rate_id: input.shipping?.rateId ?? null,
        pickup_point_id: input.shipping?.pickupPointId ?? null,
        delivery_city: input.shipping?.city ?? null,
        delivery_address: input.shipping?.address ?? null,
      };
      const hubId = scope.getScope();
      if (hubId !== undefined) insert[SCOPE_COLUMN] = hubId;

      const { data: created, error } = await client
        .from('orders')
        .insert(insert)
        .select('id')
        .single();
      if (error || !created) {
        throw new Error(`[createOrder] ${error?.message ?? 'insert failed'}`);
      }
      const orderId = String((created as Row).id);

      if (input.items.length) {
        await client.from('order_items').insert(
          input.items.map((it) => ({
            order_id: orderId,
            product_id: it.productId,
            modification_id: it.modificationId,
            name: it.name,
            price: it.price,
            quantity: it.quantity,
            total: it.price * it.quantity,
          })),
        );
      }

      const order = await this.getOrder(orderId);
      if (!order) throw new Error('[createOrder] failed to reload order');
      return order;
    },

    async getOrder(id: string): Promise<Order | null> {
      const { data } = await scoped(
        client.from('orders').select(ORDER_SELECT).eq('id', id),
      ).maybeSingle();
      return data ? mapOrder(data as Row) : null;
    },

    async listOrders(q: OrderQuery): Promise<Paged<Order>> {
      let query = scoped(
        client.from('orders').select(ORDER_SELECT, { count: 'exact' }),
      );
      if (q.status) {
        const statusId = await resolveStatusId(q.status);
        if (statusId) query = query.eq('status_id', statusId);
      }
      if (q.userId) query = query.eq('user_id', q.userId);
      if (q.search) query = query.ilike('order_number', `%${q.search}%`);
      query = query.order('created_at', { ascending: false });

      const page = q.page ?? 1;
      const pageSize = q.pageSize ?? 50;
      query = query.range((page - 1) * pageSize, page * pageSize - 1);

      const { data, count } = await query;
      const items = ((data as Row[] | null) ?? []).map(mapOrder);
      return { items, total: count ?? items.length, page, pageSize };
    },

    async updateStatus(id: string, status: string): Promise<void> {
      // status_id — UUID FK на order_statuses; не пишемо сирий рядок як FK.
      const statusId = await resolveStatusId(status);
      if (!statusId) {
        throw new Error(`[updateStatus] невідомий статус: ${status}`);
      }
      const { error } = await client
        .from('orders')
        .update({ status_id: statusId })
        .eq('id', id);
      if (error) throw new Error(`[updateStatus] ${error.message}`);
    },
  };
}
