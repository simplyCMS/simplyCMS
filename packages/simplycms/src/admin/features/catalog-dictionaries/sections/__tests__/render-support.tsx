import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { I18nProvider } from 'simplycms/i18n';

export const ROWS = [
  {
    id: 'b0000000-0000-4000-8000-000000000001',
    slug: 'laptops',
    name: 'Ноутбуки',
    description: null,
    imageUrl: 'section/x/a.jpg',
    parentId: null,
    sortOrder: 0,
    isActive: true,
    metaTitle: null,
    metaDescription: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'b0000000-0000-4000-8000-000000000002',
    slug: 'phones',
    name: 'Телефони',
    description: null,
    imageUrl: null,
    parentId: null,
    sortOrder: 1,
    isActive: false,
    metaTitle: null,
    metaDescription: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <I18nProvider locale="uk">{children}</I18nProvider>
    </QueryClientProvider>
  );
}
