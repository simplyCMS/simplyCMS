import { createFileRoute } from '@tanstack/react-router';
import { getCollection, sectionsCollection } from 'simplycms/admin-data';
import Products from 'simplycms/admin/pages/Products';

export const Route = createFileRoute('/admin/products/')({
  // 🔴 Прогріваємо лише eager-довідник розділів: preload() on-demand колекції
  // — no-op (Б-1), а перша сторінка списку залежить від фільтрів компонента.
  // UPSTREAM:TSDB-B1 — docs/architecture/upstream-workarounds.md
  loader: async ({ context }) => {
    await getCollection(context.queryClient, sectionsCollection).preload();
    return null;
  },
  component: Products,
});
