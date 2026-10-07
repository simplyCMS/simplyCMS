import { useEffect, useState } from 'react';
import { findCustomers } from 'simplycms/admin-server';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Input } from 'simplycms/ui/input';

/** Пауза після останнього символу, мс: не питаємо сервер на кожну літеру. */
export const CUSTOMER_SEARCH_DEBOUNCE_MS = 300;
/** Той самий мінімум, що й на сервері. */
const MIN_QUERY = 2;

export interface PickedCustomer {
  userId: string;
  email: string;
}

interface Props {
  /** `null` — гість. */
  readonly value: PickedCustomer | null;
  readonly onChange: (customer: PickedCustomer | null) => void;
}

/** Покупець: «Гість» або пошук за email/імʼям (`findCustomers`, `customer.manage`). */
export function CustomerPicker({ value, onChange }: Props) {
  const t = useT();
  const [query, setQuery] = useState('');
  // Відповідь привʼязана до запиту; `items: null` — запит упав.
  const [result, setResult] = useState<{
    query: string;
    items: Awaited<ReturnType<typeof findCustomers>> | null;
  } | null>(null);
  const trimmed = query.trim();
  const searchable = trimmed.length >= MIN_QUERY;

  useEffect(() => {
    if (!searchable) return;
    let current = true;
    const timer = setTimeout(() => {
      // cache-sync-ok: GET-пошук, нічого не змінює
      findCustomers({ data: { query: trimmed } })
        .then((items) => current && setResult({ query: trimmed, items }))
        .catch(() => current && setResult({ query: trimmed, items: null }));
    }, CUSTOMER_SEARCH_DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [searchable, trimmed]);

  const answered = searchable && result?.query === trimmed ? result : null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={value === null ? 'default' : 'outline'}
          aria-pressed={value === null}
          onClick={() => onChange(null)}
        >
          {t('admin.validator.guest')}
        </Button>
        {value && <span className="text-sm">{value.email}</span>}
      </div>
      <Input
        value={query}
        placeholder={t('admin.validator.customerSearch')}
        onChange={(e) => setQuery(e.target.value)}
      />
      {answered?.items === null && (
        <p role="alert" className="text-sm text-destructive">
          {t('admin.validator.customerFailed')}
        </p>
      )}
      {answered?.items?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t('admin.validator.customerEmpty')}
        </p>
      )}
      <ul className="max-h-48 space-y-1 overflow-y-auto">
        {answered?.items?.map((c) => (
          <li key={c.userId}>
            <button
              type="button"
              className="w-full rounded-md border p-2 text-left hover:bg-accent"
              onClick={() => onChange({ userId: c.userId, email: c.email })}
            >
              <span className="font-medium">{c.email}</span>
              {c.name && <span className="ml-2 text-sm">{c.name}</span>}
              {c.categoryName && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {c.categoryName}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
