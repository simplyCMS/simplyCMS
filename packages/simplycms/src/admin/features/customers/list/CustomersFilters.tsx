import { useLiveQuery } from '@tanstack/react-db';
import { Search } from 'lucide-react';
import { userCategoriesCollection, useCollection } from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import { Checkbox } from 'simplycms/ui/checkbox';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'simplycms/ui/select';
import type { CustomersFilters as Filters } from './useCustomersList';

// Radix Select не приймає порожній рядок як value — сентинел «усі».
const ALL = '__all__';

interface Props {
  /** Сире значення поля пошуку (debounce і поріг у 2 символи — на сторінці). */
  readonly search: string;
  readonly filters: Filters;
  readonly onSearch: (value: string) => void;
  readonly onChange: (patch: Partial<Filters>) => void;
}

/** Пошук, категорія, роль і «лише заблоковані». */
export default function CustomersFilters({
  search,
  filters,
  onSearch,
  onChange,
}: Props) {
  const t = useT();
  const categories = useCollection(userCategoriesCollection);
  const { data: rows } = useLiveQuery({
    query: (q) => q.from({ c: categories }).orderBy(({ c }) => c.name, 'asc'),
  });
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="relative min-w-64 flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          value={search}
          placeholder={t('admin.users.searchPlaceholder')}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="customers-filter-category">
          {t('admin.users.category')}
        </Label>
        <Select
          value={filters.categoryId ?? ALL}
          onValueChange={(v) =>
            onChange({ categoryId: v === ALL ? undefined : v })
          }
        >
          <SelectTrigger id="customers-filter-category" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>
              {t('admin.users.allCategories')}
            </SelectItem>
            {rows.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="customers-filter-role">{t('admin.users.role')}</Label>
        <Select
          value={filters.role ?? ALL}
          onValueChange={(v) =>
            onChange({ role: v === ALL ? undefined : (v as Filters['role']) })
          }
        >
          <SelectTrigger id="customers-filter-role" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('admin.users.allRoles')}</SelectItem>
            <SelectItem value="admin">{t('admin.users.admins')}</SelectItem>
            <SelectItem value="customer">{t('admin.users.user')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2 pb-2">
        <Checkbox
          id="customers-filter-banned"
          checked={filters.banned === true}
          onCheckedChange={(v) => onChange({ banned: v === true || undefined })}
        />
        <Label htmlFor="customers-filter-banned">
          {t('admin.users.onlyBanned')}
        </Label>
      </div>
    </div>
  );
}
