import { createFileRoute } from '@tanstack/react-router';
import { createServerSupabase } from 'simplycms/supabase/server-client';

interface GuestOrderItem {
  modification_id: string;
  quantity: number;
  price: number;
  name?: string;
}

/**
 * Створення замовлення гостем (без авторизації).
 *
 * HTTP server route — лишається доступним для зовнішніх клієнтів (не лише React).
 */
export const Route = createFileRoute('/api/guest-order')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = await request.json();
          const {
            first_name,
            last_name,
            phone,
            email,
            items,
            notes,
            payment_method,
          } = body;

          if (!first_name || !last_name || !phone || !email || !items?.length) {
            return Response.json(
              {
                error:
                  'first_name, last_name, phone, email, and at least one item are required',
              },
              { status: 400 },
            );
          }

          const supabase = createServerSupabase();

          const subtotal = (items as GuestOrderItem[]).reduce(
            (sum, item) => sum + item.price * item.quantity,
            0,
          );

          const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
              first_name,
              last_name,
              phone,
              email,
              order_number: `GUEST-${Date.now()}`,
              payment_method: payment_method || 'cash',
              subtotal,
              total: subtotal,
              notes: notes || null,
            })
            .select()
            .single();

          if (orderError) {
            return Response.json(
              { error: orderError.message },
              { status: 500 },
            );
          }

          const orderItems = (items as GuestOrderItem[]).map((item) => ({
            order_id: order.id,
            modification_id: item.modification_id,
            quantity: item.quantity,
            price: item.price,
            name: item.name ?? 'Товар',
            total: item.price * item.quantity,
          }));

          const { error: itemsError } = await supabase
            .from('order_items')
            .insert(orderItems);

          if (itemsError) {
            return Response.json(
              { error: itemsError.message },
              { status: 500 },
            );
          }

          return Response.json({ order_id: order.id }, { status: 201 });
        } catch {
          return Response.json(
            { error: 'Internal server error' },
            { status: 500 },
          );
        }
      },
    },
  },
});
