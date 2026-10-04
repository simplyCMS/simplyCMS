import { useEffect, useState } from 'react';
import { searchProductsForOrder } from 'simplycms/admin-server';
import { useT } from 'simplycms/i18n';
import { Input } from 'simplycms/ui/input';

/** Пауза після останнього символу, мс (Е5б-4): не питаємо сервер на кожну літеру. */
export const SEARCH_DEBOUNCE_MS = 300;
/** Той самий мінімум, що й на сервері: коротший запит БД не чіпає. */
const MIN_QUERY = 2;

export interface ProductHit {
  productId: string;
  name: string;
  sku: string | null;
  hasModifications: boolean;
}

interface Props {
  readonly onSelect: (hit: ProductHit) => void;
}

/**
 * Пошук товару для додавання в замовлення. 🔴 Показується відповідь лише на
 * ОСТАННІЙ запит: cleanup ефекту скасовує застарілий виклик, тож порядок
 * надходження відповідей значення не має.
 */
export function ProductSearchList({ onSelect }: Props) {
  const t = useT();
  const [query, setQuery] = useState('');
  // Результат привʼязаний до запиту, на який відповів сервер: під час
  // debounce і польоту нового запиту відповідь попереднього не показується.
  // `items: null` — запит упав: це стан помилки, а не «нічого не знайдено».
  const [result, setResult] = useState<{
    query: string;
    items: ProductHit[] | null;
  } | null>(null);
  const trimmed = query.trim();
  const searchable = trimmed.length >= MIN_QUERY;

  useEffect(() => {
    if (!searchable) return;
    let current = true;
    const timer = setTimeout(() => {
      // cache-sync-ok: GET-пошук, нічого не змінює — кешу синкати нічого
      searchProductsForOrder({ data: { query: trimmed } })
        .then((res) => {
          if (current) setResult({ query: trimmed, items: res.items });
        })
        .catch(() => {
          if (current) setResult({ query: trimmed, items: null });
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [searchable, trimmed]);

  const answered = searchable && result?.query === trimmed ? result : null;
  const shown = answered?.items ?? null;
  return (
    <div className="space-y-3">
      <Input
        autoFocus
        value={query}
        placeholder={t('admin.orders.searchPlaceholder')}
        onChange={(e) => setQuery(e.target.value)}
      />
      {!searchable && (
        <p className="text-sm text-muted-foreground">
          {t('admin.orders.searchHint')}
        </p>
      )}
      {answered && answered.items === null && (
        <p role="alert" className="text-sm text-destructive">
          {t('admin.orders.searchFailed')}
        </p>
      )}
      {shown?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t('admin.orders.searchEmpty')}
        </p>
      )}
      <ul className="max-h-64 space-y-1 overflow-y-auto">
        {shown?.map((hit) => (
          <li key={hit.productId}>
            <button
              type="button"
              className="w-full rounded-md border p-2 text-left hover:bg-accent"
              onClick={() => onSelect(hit)}
            >
              <span className="font-medium">{hit.name}</span>
              {hit.sku && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {t('admin.orders.sku')} {hit.sku}
                </span>
              )}
              {hit.hasModifications && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {t('admin.orders.hasModifications')}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
