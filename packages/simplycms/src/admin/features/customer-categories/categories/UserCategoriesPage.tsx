import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useLiveQuery } from '@tanstack/react-db';
import {
  priceTypesCollection,
  useCollection,
  userCategoriesCollection,
} from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Card, CardContent } from 'simplycms/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'simplycms/ui/table';
import { Plus, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { adminPath } from '../../../lib/adminLinks';
import { reportTxError } from '../../../lib/report-tx-error';
import { DeleteConfirmDialog } from '../../catalog-dictionaries/DeleteConfirmDialog';
import { PageSpinner } from '../../catalog-dictionaries/PageStates';
import { UserCategoryRow } from './UserCategoryRow';
import { useCategoryCustomerCounts } from './useCategoryCustomerCounts';
import { useUserCategoryDefault } from './useUserCategoryDefault';

/**
 * Список категорій покупців (Е6в, Task 9): жива eager-колекція. Видалення —
 * `collection.delete` → guarded `removeUserCategories`; чотири відмови
 * (Е6в-18) показують власні тости через `reportTxError`.
 */
export default function UserCategoriesPage() {
  const t = useT();
  const collection = useCollection(userCategoriesCollection);
  const priceTypes = useCollection(priceTypesCollection);
  const counts = useCategoryCustomerCounts();
  const applyDefault = useUserCategoryDefault();
  const { data: categories, isLoading } = useLiveQuery({
    query: (q) => q.from({ c: collection }).orderBy(({ c }) => c.name, 'asc'),
  });
  const { data: types } = useLiveQuery({
    query: (q) => q.from({ p: priceTypes }),
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const makeDefault = (id: string) =>
    applyDefault(id)
      .then(() =>
        toast.success(t('admin.customerCategories.categories.defaultSet')),
      )
      .catch((e: unknown) => reportTxError(t, e));

  const handleDelete = (id: string) => {
    setDeleteId(null);
    collection
      .delete(id)
      .isPersisted.promise.then(() =>
        toast.success(t('admin.users.categories.deleted')),
      )
      .catch((e: unknown) => reportTxError(t, e));
  };

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {t('admin.nav.userCategories')}
          </h1>
          <p className="text-muted-foreground">
            {t('admin.users.categories.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={adminPath('user-categories/rules')}>
              <Settings className="mr-2 h-4 w-4" />
              {t('admin.users.categories.rules')}
            </Link>
          </Button>
          <Button asChild>
            <Link
              to={adminPath('user-categories/$categoryId')}
              params={{ categoryId: 'new' }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('admin.users.categories.add')}
            </Link>
          </Button>
        </div>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common.name')}</TableHead>
                <TableHead>{t('common.code')}</TableHead>
                <TableHead>{t('admin.users.priceType')}</TableHead>
                <TableHead className="text-center">
                  {t('admin.users.categories.usersCount')}
                </TableHead>
                <TableHead className="text-right">
                  {t('common.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => (
                <UserCategoryRow
                  key={c.id}
                  category={c}
                  priceTypeName={
                    types.find((p) => p.id === c.priceTypeId)?.name ?? null
                  }
                  customers={counts.get(c.id)}
                  onMakeDefault={() => makeDefault(c.id)}
                  onDelete={() => setDeleteId(c.id)}
                />
              ))}
              {categories.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    {t('admin.users.categories.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <DeleteConfirmDialog
        title={t('admin.users.categories.deleteTitle')}
        warning={t('admin.customerCategories.categories.deleteWarning')}
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
      />
    </div>
  );
}
