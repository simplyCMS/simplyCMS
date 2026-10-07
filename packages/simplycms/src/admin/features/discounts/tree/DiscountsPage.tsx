import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useT } from 'simplycms/i18n';
import type { Discount, DiscountGroup } from 'simplycms/schema/types';
import { Button } from 'simplycms/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { DollarSign, Percent, Plus } from 'lucide-react';
import { adminPath } from '../../../lib/adminLinks';
import { DeleteConfirmDialog } from '../../catalog-dictionaries/DeleteConfirmDialog';
import { PageSpinner } from '../../catalog-dictionaries/PageStates';
import {
  DiscountGroupNode,
  type DiscountTreeActions,
} from './DiscountGroupNode';
import { useDiscountTree } from './useDiscountTree';

const NEW_GROUP = {
  to: adminPath('discounts/groups/$groupId'),
  params: { groupId: 'new' },
} as const;

/**
 * Дерево знижок (К3-Е6в, Task 8): групи з операторами, знижки під групою.
 * Видалення групи підтверджується з підрахунком каскаду
 * (`countGroupSubtree`): власник бачить, скільки груп і знижок зникне.
 */
export default function DiscountsPage() {
  const t = useT();
  const tree = useDiscountTree();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [groupToDelete, setGroupToDelete] = useState<DiscountGroup | null>(
    null,
  );
  const [discountToDelete, setDiscountToDelete] = useState<Discount | null>(
    null,
  );

  const actions: DiscountTreeActions = {
    isCollapsed: (id) => collapsed.has(id),
    toggleCollapsed: (id) =>
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
    toggleActive: (id, v) => void tree.toggleGroup(id, v),
    askDeleteGroup: setGroupToDelete,
    askDeleteDiscount: setDiscountToDelete,
  };

  if (tree.isLoading) return <PageSpinner />;
  const roots = tree.model.childrenOf(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('admin.nav.discounts')}</h1>
          <p className="mt-1 text-muted-foreground">
            {t('admin.discounts.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={adminPath('price-validator')}>
              <DollarSign className="mr-2 h-4 w-4" />
              {t('admin.nav.priceValidator')}
            </Link>
          </Button>
          <Button asChild>
            <Link {...NEW_GROUP}>
              <Plus className="mr-2 h-4 w-4" />
              {t('admin.discounts.newGroup')}
            </Link>
          </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.discounts.tree')}</CardTitle>
        </CardHeader>
        <CardContent>
          {roots.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Percent className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>{t('admin.discounts.empty')}</p>
              <Button variant="outline" className="mt-4" asChild>
                <Link {...NEW_GROUP}>{t('admin.discounts.createFirst')}</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {roots.map((g) => (
                <DiscountGroupNode
                  key={g.id}
                  group={g}
                  model={tree.model}
                  actions={actions}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <DeleteConfirmDialog
        title={t('admin.discounts.deleteGroupTitle')}
        warning={
          groupToDelete
            ? t('admin.discounts.deleteGroupText', {
                ...tree.subtreeSize(groupToDelete.id),
              })
            : ''
        }
        open={groupToDelete !== null}
        onOpenChange={(open) => !open && setGroupToDelete(null)}
        onConfirm={() => {
          if (groupToDelete) void tree.deleteGroup(groupToDelete.id);
          setGroupToDelete(null);
        }}
      />
      <DeleteConfirmDialog
        title={t('admin.discounts.deleteTitle')}
        warning={
          discountToDelete
            ? t('admin.discounts.deleteText', { name: discountToDelete.name })
            : ''
        }
        open={discountToDelete !== null}
        onOpenChange={(open) => !open && setDiscountToDelete(null)}
        onConfirm={() => {
          if (discountToDelete) void tree.deleteDiscount(discountToDelete.id);
          setDiscountToDelete(null);
        }}
      />
    </div>
  );
}
