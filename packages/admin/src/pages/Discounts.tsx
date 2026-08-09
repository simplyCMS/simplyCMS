import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  Plus,
  ChevronRight,
  ChevronDown,
  Percent,
  DollarSign,
  Tag,
  Trash2,
  Pencil,
} from 'lucide-react';
import { Button } from '@simplycms/ui/button';
import { Badge } from '@simplycms/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@simplycms/ui/card';
import { Switch } from '@simplycms/ui/switch';
import { useSupabaseClient } from '@simplycms/supabase/SupabaseProvider';
import { useT, type MessageKey } from '@simplycms/i18n';
import { toast } from '@simplycms/core/hooks/use-toast';
import type { Tables } from '@simplycms/supabase';
import { adminPath } from '../lib/adminLinks';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@simplycms/ui/alert-dialog';

// Мапа КЛЮЧІВ: оператор групи — enum БД.
const operatorLabels: Record<string, MessageKey> = {
  and: 'admin.discounts.op.and',
  or: 'admin.discounts.op.or',
  not: 'admin.discounts.op.not',
  min: 'admin.discounts.op.min',
  max: 'admin.discounts.op.max',
};

const operatorColors: Record<string, string> = {
  and: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  or: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  not: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  min: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  max: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

// Суфікс одиниці біля значення знижки. «грн» — кирилиця, тож ключ каталогу;
// «%» лишається символом.
const discountTypeSuffix: Record<string, MessageKey | string> = {
  percent: '%',
  fixed_amount: 'admin.discounts.uah',
  fixed_price: 'admin.discounts.uahFixed',
};

/** Знижка з приєднаним видом ціни */
type DiscountWithPriceType = Tables<'discounts'> & {
  price_types: { name: string } | null;
};

interface DiscountGroup {
  id: string;
  name: string;
  description: string | null;
  operator: string;
  parent_group_id: string | null;
  is_active: boolean;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  discounts?: DiscountWithPriceType[];
  children?: DiscountGroup[];
}

export default function Discounts() {
  const t = useT();
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['discount-groups-tree'],
    queryFn: async () => {
      const { data: allGroups, error: gErr } = await supabase
        .from('discount_groups')
        .select('*')
        .order('priority');
      if (gErr) throw gErr;

      const { data: allDiscounts, error: dErr } = await supabase
        .from('discounts')
        .select('*, price_types(name)')
        .order('priority');
      if (dErr) throw dErr;

      // Build tree
      const map = new Map<string, DiscountGroup>();
      for (const g of allGroups) {
        map.set(g.id, {
          ...g,
          discounts: [],
          children: [],
        });
      }
      for (const d of allDiscounts || []) {
        map.get(d.group_id)?.discounts?.push(d);
      }
      const roots: DiscountGroup[] = [];
      for (const g of map.values()) {
        if (g.parent_group_id && map.has(g.parent_group_id)) {
          map.get(g.parent_group_id)!.children!.push(g);
        } else {
          roots.push(g);
        }
      }
      return roots;
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({
      id,
      is_active,
    }: {
      id: string;
      is_active: boolean;
    }) => {
      const { error } = await supabase
        .from('discount_groups')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['discount-groups-tree'] }),
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('discount_groups')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-groups-tree'] });
      toast({ title: t('admin.discounts.groupDeleted') });
    },
  });

  const deleteDiscount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('discounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-groups-tree'] });
      toast({ title: t('admin.discounts.deleted') });
    },
  });

  const toggleExpanded = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  function renderGroup(group: DiscountGroup, depth: number = 0) {
    const isExpanded = expandedGroups.has(group.id);
    return (
      <div
        key={group.id}
        style={{ marginLeft: depth * 24 }}
        className="border-l-2 border-muted pl-4 mb-2"
      >
        <div className="flex items-center gap-2 py-2 group">
          <button onClick={() => toggleExpanded(group.id)} className="p-0.5">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>

          <Badge variant="outline" className={operatorColors[group.operator]}>
            {t(operatorLabels[group.operator])}
          </Badge>

          <span
            className={`font-medium ${!group.is_active ? 'text-muted-foreground line-through' : ''}`}
          >
            {group.name}
          </span>

          {group.starts_at || group.ends_at ? (
            <Badge variant="outline" className="text-xs">
              {group.starts_at
                ? new Date(group.starts_at).toLocaleDateString()
                : '∞'}
              {' — '}
              {group.ends_at
                ? new Date(group.ends_at).toLocaleDateString()
                : '∞'}
            </Badge>
          ) : null}

          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Switch
              checked={group.is_active}
              onCheckedChange={(checked) =>
                toggleActive.mutate({ id: group.id, is_active: checked })
              }
            />
            <Button variant="ghost" size="icon" asChild>
              <Link
                to={adminPath('discounts/groups/$groupId')}
                params={{ groupId: group.id }}
              >
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t('admin.discounts.deleteGroupTitle')}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('admin.discounts.deleteGroupText')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteGroup.mutate(group.id)}
                  >
                    {t('common.delete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {isExpanded && (
          <div className="ml-2">
            {/* Discounts in this group */}
            {group.discounts?.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-2 py-1.5 pl-6 group/discount"
              >
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                <span
                  className={`text-sm ${!d.is_active ? 'text-muted-foreground line-through' : ''}`}
                >
                  {d.name}
                </span>
                <Badge variant="outline" className="text-xs">
                  {d.discount_type === 'percent'
                    ? '-'
                    : d.discount_type === 'fixed_price'
                      ? '='
                      : '-'}
                  {d.discount_value}
                  {discountTypeSuffix[d.discount_type] === '%'
                    ? '%'
                    : t(discountTypeSuffix[d.discount_type] as MessageKey)}
                </Badge>
                {d.price_types && (
                  <Badge variant="secondary" className="text-xs">
                    {d.price_types.name}
                  </Badge>
                )}
                <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover/discount:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    asChild
                  >
                    <Link
                      to={adminPath('discounts/$discountId')}
                      params={{ discountId: d.id }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Link>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {t('admin.discounts.deleteTitle')}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('admin.discounts.deleteText', { name: d.name })}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>
                          {t('common.cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteDiscount.mutate(d.id)}
                        >
                          {t('common.delete')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}

            {/* Child groups */}
            {group.children?.map((child) => renderGroup(child, depth + 1))}

            {/* Add buttons */}
            <div className="flex gap-2 py-1 pl-6">
              <Button variant="ghost" size="sm" className="text-xs h-7" asChild>
                <Link
                  to={adminPath('discounts/$discountId')}
                  params={{ discountId: 'new' }}
                  search={{ groupId: group.id }}
                >
                  <Plus className="h-3 w-3 mr-1" />{' '}
                  {t('admin.discounts.discount')}
                </Link>
              </Button>
              <Button variant="ghost" size="sm" className="text-xs h-7" asChild>
                <Link
                  to={adminPath('discounts/groups/$groupId')}
                  params={{ groupId: 'new' }}
                  search={{ parentId: group.id }}
                >
                  <Plus className="h-3 w-3 mr-1" />{' '}
                  {t('admin.discounts.subgroup')}
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('admin.nav.discounts')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('admin.discounts.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={adminPath('price-validator')}>
              <DollarSign className="h-4 w-4 mr-2" />{' '}
              {t('admin.nav.priceValidator')}
            </Link>
          </Button>
          <Button asChild>
            <Link
              to={adminPath('discounts/groups/$groupId')}
              params={{ groupId: 'new' }}
            >
              <Plus className="h-4 w-4 mr-2" /> {t('admin.discounts.newGroup')}
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.discounts.tree')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">{t('common.loading')}</p>
          ) : groups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Percent className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('admin.discounts.empty')}</p>
              <Button variant="outline" className="mt-4" asChild>
                <Link
                  to={adminPath('discounts/groups/$groupId')}
                  params={{ groupId: 'new' }}
                >
                  {t('admin.discounts.createFirst')}
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-1">{groups.map((g) => renderGroup(g))}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
