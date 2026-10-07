import { Link } from '@tanstack/react-router';
import { useLiveQuery } from '@tanstack/react-db';
import {
  categoryRulesCollection,
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
import { ArrowLeft, Loader2, Play, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { adminPath } from '../../../lib/adminLinks';
import { reportTxError } from '../../../lib/report-tx-error';
import { PageSpinner } from '../../catalog-dictionaries/PageStates';
import { CategoryRuleRow } from './CategoryRuleRow';
import { useRunCategoryRules } from './useRunCategoryRules';

/**
 * Список автоправил (Е6в, Task 9): жива eager-колекція, перемикач
 * активності й пріоритет — `collection.update`; «Запустити всі правила» —
 * `runCategoryRules` через `useRunCategoryRules`.
 */
export default function CategoryRulesPage() {
  const t = useT();
  const collection = useCollection(categoryRulesCollection);
  const categoriesCollection = useCollection(userCategoriesCollection);
  const { run, running } = useRunCategoryRules();
  const { data: rules, isLoading } = useLiveQuery({
    query: (q) =>
      q.from({ r: collection }).orderBy(({ r }) => r.priority, 'desc'),
  });
  const { data: categories } = useLiveQuery({
    query: (q) => q.from({ c: categoriesCollection }),
  });
  const nameOf = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? null;

  const save = (id: string, patch: { isActive?: boolean; priority?: number }) =>
    collection
      .update(id, (d) => {
        Object.assign(d, patch);
      })
      .isPersisted.promise.then(() => toast.success(t('common.changesSaved')))
      .catch((e: unknown) => reportTxError(t, e));

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={adminPath('user-categories')}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {t('admin.users.categories.rules')}
            </h1>
            <p className="text-muted-foreground">
              {t('admin.users.rules.subtitle')}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={run} disabled={running}>
            {running ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            {t('admin.customerCategories.rules.run')}
          </Button>
          <Button asChild>
            <Link
              to={adminPath('user-categories/rules/$ruleId')}
              params={{ ruleId: 'new' }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('admin.users.rules.add')}
            </Link>
          </Button>
        </div>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">{t('common.priority')}</TableHead>
                <TableHead>{t('common.name')}</TableHead>
                <TableHead>{t('admin.users.rules.transition')}</TableHead>
                <TableHead>{t('admin.users.rules.conditions')}</TableHead>
                <TableHead className="w-24 text-center">
                  {t('common.activeN')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <CategoryRuleRow
                  key={r.id}
                  rule={r}
                  fromName={nameOf(r.fromCategoryId)}
                  toName={nameOf(r.toCategoryId)}
                  onToggle={(v) => save(r.id, { isActive: v })}
                  onPriority={(d) => save(r.id, { priority: r.priority + d })}
                />
              ))}
              {rules.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    {t('admin.users.rules.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">
        <strong>{t('common.howItWorks')}</strong>{' '}
        {t('admin.customerCategories.rules.howItWorks')}
      </p>
    </div>
  );
}
