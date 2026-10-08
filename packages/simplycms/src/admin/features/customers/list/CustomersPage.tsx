import { useEffect, useState } from 'react';
import { useT } from 'simplycms/i18n';
import { Card, CardContent } from 'simplycms/ui/card';
import CustomersFilters from './CustomersFilters';
import CustomersTable from './CustomersTable';
import {
  useCustomersList,
  type CustomersFilters as Filters,
} from './useCustomersList';

const SEARCH_DEBOUNCE_MS = 300;
/** Серверна схема відхиляє пошук коротший за 2 символи — не питаємо. */
const SEARCH_MIN = 2;

/** Список покупців (`users LEFT JOIN profiles`) на серверному читанні. */
export default function CustomersPage() {
  const t = useT();
  const [filters, setFilters] = useState<Filters>({});
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const id = setTimeout(
      () => setDebounced(search.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(id);
  }, [search]);
  const effective: Filters = {
    ...filters,
    search: debounced.length >= SEARCH_MIN ? debounced : undefined,
  };
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useCustomersList(effective);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('admin.nav.users')}</h1>
        <p className="text-muted-foreground">{t('admin.users.subtitle')}</p>
      </div>
      <CustomersFilters
        search={search}
        filters={filters}
        onSearch={setSearch}
        onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
      />
      <Card>
        <CardContent className="pt-6">
          <CustomersTable
            rows={data?.pages.flatMap((p) => p.rows) ?? []}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={() => fetchNextPage()}
          />
        </CardContent>
      </Card>
    </div>
  );
}
