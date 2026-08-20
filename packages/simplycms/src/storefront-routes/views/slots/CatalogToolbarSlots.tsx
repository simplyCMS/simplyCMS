import type { ComponentProps } from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { CATALOG_REQUISITES } from 'simplycms/contracts/views';
import { useT } from 'simplycms/i18n';
import { ActiveFilters } from '@simplycms/core/components/catalog/ActiveFilters';
import { Button } from 'simplycms/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'simplycms/ui/select';
import { cn } from 'simplycms/ui/utils';

/** Порядок сортування вибірки каталогу. */
export type CatalogSortOption =
  'popular' | 'price_asc' | 'price_desc' | 'newest';

/** Режим показу вибірки: сітка або список. */
export type CatalogViewMode = 'grid' | 'list';

export interface CatalogSortSelectProps {
  className?: string;
  value: CatalogSortOption;
  onChange: (value: CatalogSortOption) => void;
}

/**
 * Реквізит «сортування». Маркер стоїть на самому тригері селекта, а не на
 * зайвій обгортці: Radix-корінь DOM-вузла не створює.
 */
export function CatalogSortSelect({
  className,
  value,
  onChange,
}: CatalogSortSelectProps) {
  const t = useT();

  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as CatalogSortOption)}
    >
      {/* 🔴 160px на мобільному, 180 від sm: при 390px повні 180 не лишали
          місця лічильнику товарів, і той обрізався до «4 т...». */}
      <SelectTrigger
        data-simplycms-requisite={CATALOG_REQUISITES.SortSelect}
        className={cn('w-[160px] sm:w-[180px]', className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="popular">{t('catalog.sort.popular')}</SelectItem>
        <SelectItem value="newest">{t('catalog.sort.newest')}</SelectItem>
        <SelectItem value="price_asc">{t('catalog.sort.priceAsc')}</SelectItem>
        <SelectItem value="price_desc">
          {t('catalog.sort.priceDesc')}
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

export interface CatalogViewModeToggleProps {
  className?: string;
  value: CatalogViewMode;
  onChange: (value: CatalogViewMode) => void;
}

/** Реквізит «сітка / список». */
export function CatalogViewModeToggle({
  className,
  value,
  onChange,
}: CatalogViewModeToggleProps) {
  return (
    <div
      data-simplycms-requisite={CATALOG_REQUISITES.ViewModeToggle}
      className={cn('hidden sm:flex border rounded-md', className)}
    >
      <Button
        variant={value === 'grid' ? 'secondary' : 'ghost'}
        size="icon"
        className="rounded-r-none"
        onClick={() => onChange('grid')}
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
      <Button
        variant={value === 'list' ? 'secondary' : 'ghost'}
        size="icon"
        className="rounded-l-none"
        onClick={() => onChange('list')}
      >
        <List className="h-4 w-4" />
      </Button>
    </div>
  );
}

export interface CatalogActiveFiltersProps extends ComponentProps<
  typeof ActiveFilters
> {
  className?: string;
}

/**
 * Реквізит «активні фільтри». `ActiveFilters` для порожнього списку рендерить
 * `null`, тому маркер тримає прозора (`display: contents`) обгортка — вона
 * присутня завжди й розкладки не змінює.
 */
export function CatalogActiveFilters({
  className,
  ...rest
}: CatalogActiveFiltersProps) {
  return (
    <div
      data-simplycms-requisite={CATALOG_REQUISITES.ActiveFilters}
      className={cn('contents', className)}
    >
      <ActiveFilters {...rest} />
    </div>
  );
}
