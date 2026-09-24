import { useLiveQuery } from '@tanstack/react-db';
import { sectionsCollection, useCollection } from 'simplycms/admin-data';
import type { StockStatus } from 'simplycms/contracts';
import { useT } from 'simplycms/i18n';
import { Label } from 'simplycms/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'simplycms/ui/select';
import type { ProductFilters as ProductFiltersState } from './useProductsList';

// Radix Select не приймає порожній рядок як value — сентинел «усі».
const ALL = '__all__';

interface Props {
  readonly filters: ProductFiltersState;
  readonly onChange: (filters: ProductFiltersState) => void;
}

/** Три фільтри списку товарів (Е3-2): розділ / активність / наявність. */
export default function ProductsFilters({ filters, onChange }: Props) {
  const t = useT();
  const sections = useCollection(sectionsCollection);
  const { data: sectionRows } = useLiveQuery((q) =>
    q.from({ s: sections }).orderBy(({ s }) => s.name, 'asc'),
  );

  return (
    <div className="flex flex-wrap gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="products-filter-section">
          {t('admin.products.filters.section')}
        </Label>
        <Select
          value={filters.sectionId ?? ALL}
          onValueChange={(v) =>
            onChange({ ...filters, sectionId: v === ALL ? undefined : v })
          }
        >
          <SelectTrigger id="products-filter-section" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>
              {t('admin.products.filters.all')}
            </SelectItem>
            {sectionRows.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="products-filter-active">
          {t('admin.products.filters.active')}
        </Label>
        <Select
          value={
            filters.isActive === undefined ? ALL : String(filters.isActive)
          }
          onValueChange={(v) =>
            onChange({
              ...filters,
              isActive: v === ALL ? undefined : v === 'true',
            })
          }
        >
          <SelectTrigger id="products-filter-active" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>
              {t('admin.products.filters.all')}
            </SelectItem>
            <SelectItem value="true">
              {t('admin.products.filters.activeOnly')}
            </SelectItem>
            <SelectItem value="false">
              {t('admin.products.filters.inactiveOnly')}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="products-filter-stock">
          {t('admin.products.filters.stock')}
        </Label>
        <Select
          value={filters.stockStatus ?? ALL}
          onValueChange={(v) =>
            onChange({
              ...filters,
              stockStatus: v === ALL ? undefined : (v as StockStatus),
            })
          }
        >
          <SelectTrigger id="products-filter-stock" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>
              {t('admin.products.filters.all')}
            </SelectItem>
            <SelectItem value="in_stock">
              {t('admin.products.stock.inStock')}
            </SelectItem>
            <SelectItem value="out_of_stock">
              {t('admin.products.stock.outOfStock')}
            </SelectItem>
            <SelectItem value="on_order">
              {t('admin.products.stock.onOrder')}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
