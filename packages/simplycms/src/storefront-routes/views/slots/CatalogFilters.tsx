import type { ComponentProps } from 'react';
import { CATALOG_REQUISITES } from 'simplycms/contracts/views';
import { FilterSidebar } from '@simplycms/core/components/catalog/FilterSidebar';
import { cn } from 'simplycms/ui/utils';

export interface CatalogFiltersProps extends ComponentProps<
  typeof FilterSidebar
> {
  className?: string;
}

/**
 * Реквізит «фільтри». Слот навмисно не тягне за собою місце показу: тема
 * ставить його і в сайдбар, і в мобільну шторку (`Sheet`) — маркер у такому
 * разі трапляється двічі, для conformance важлива лише присутність.
 */
export function CatalogFilters({ className, ...rest }: CatalogFiltersProps) {
  return (
    <div
      data-simplycms-requisite={CATALOG_REQUISITES.Filters}
      className={cn('contents', className)}
    >
      <FilterSidebar {...rest} />
    </div>
  );
}
