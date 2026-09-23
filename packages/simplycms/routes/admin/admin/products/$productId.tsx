import { createFileRoute } from '@tanstack/react-router';
import {
  getCollection,
  priceTypesCollection,
  sectionsCollection,
} from 'simplycms/admin-data';
import ProductEdit from 'simplycms/admin/pages/ProductEdit';

export const Route = createFileRoute('/admin/products/$productId')({
  // 🔴 Прогріваємо лише eager-довідники (розділи, типи цін): картка товару
  // потребує обидва — розділ у сайдбарі (Task 7), типи цін у Task 8.
  // preload() on-demand колекції товару — no-op (Б-1), сам рядок тягне
  // `findOne` у `ProductEditPage`.
  loader: async ({ context }) => {
    await Promise.all([
      getCollection(context.queryClient, sectionsCollection).preload(),
      getCollection(context.queryClient, priceTypesCollection).preload(),
    ]);
    return null;
  },
  component: ProductEdit,
});
