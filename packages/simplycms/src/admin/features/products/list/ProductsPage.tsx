import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Plus } from 'lucide-react';
import { adminPath } from '../../../lib/adminLinks';
import ProductsFilters from './ProductsFilters';
import ProductsTable from './ProductsTable';
import { useProductsList, type ProductFilters } from './useProductsList';

/**
 * Список товарів (Task 6) — перша сторінка каталогу на on-demand колекції.
 * Дані/пагінація — `useProductsList`; фільтри й таблиця — окремі компоненти
 * (`ProductsFilters`/`ProductsTable`); синк з URL search — поза етапом.
 */
export default function ProductsPage() {
  const t = useT();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<ProductFilters>({});
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useProductsList(filters);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('admin.nav.products')}</h1>
          <p className="text-muted-foreground">
            {t('admin.products.subtitle')}
          </p>
        </div>
        <Button
          onClick={() =>
            navigate({
              to: adminPath('products/$productId'),
              params: { productId: 'new' },
            })
          }
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('admin.products.add')}
        </Button>
      </div>

      <ProductsFilters filters={filters} onChange={setFilters} />

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.products.all')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductsTable
            rows={data}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={() => fetchNextPage()}
          />
        </CardContent>
      </Card>
    </div>
  );
}
