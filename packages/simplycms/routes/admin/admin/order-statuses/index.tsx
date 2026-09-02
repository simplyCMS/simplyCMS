import { createFileRoute } from '@tanstack/react-router';
import { getCollection, orderStatusesCollection } from 'simplycms/admin-data';
import OrderStatuses from 'simplycms/admin/pages/OrderStatuses';

export const Route = createFileRoute('/admin/order-statuses/')({
  // Батько /admin має ssr:false — loader КЛІЄНТСЬКИЙ; preload тут стартує
  // синк колекції під час навігації, без спалаху порожньої таблиці.
  loader: async ({ context }) => {
    await getCollection(context.queryClient, orderStatusesCollection).preload();
    return null;
  },
  component: OrderStatuses,
});
