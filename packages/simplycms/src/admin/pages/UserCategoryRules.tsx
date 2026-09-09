import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from '@tanstack/react-router';
import { useSupabaseClient } from 'simplycms/supabase/SupabaseProvider';
import { useT, type MessageKey } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Badge } from 'simplycms/ui/badge';
import { Switch } from 'simplycms/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'simplycms/ui/table';
import {
  ArrowLeft,
  Plus,
  Play,
  ArrowRight,
  Loader2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'simplycms/core/hooks/use-toast';
import { adminPath } from '../lib/adminLinks';

interface RuleCondition {
  field: string;
  operator: string;
  value: string | number;
}

interface RuleConditions {
  type: 'all' | 'any';
  rules: RuleCondition[];
}

// Мапа КЛЮЧІВ: код поля умови зберігається в БД.
const fieldLabels: Record<string, MessageKey | string> = {
  total_purchases: 'admin.users.totalSpent',
  registration_days: 'admin.users.daysSince',
  orders_count: 'admin.users.rules.field.ordersCount',
  email_domain: 'admin.users.emailDomain',
  auth_provider: 'admin.users.rules.field.authProvider',
  utm_source: 'UTM Source',
  utm_campaign: 'UTM Campaign',
};

export default function UserCategoryRules() {
  const t = useT();
  const supabase = useSupabaseClient();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);

  // Fetch rules with categories
  const { data: rules, isLoading } = useQuery({
    queryKey: ['category-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('category_rules')
        .select(
          `
          *,
          from_category:user_categories!category_rules_from_category_id_fkey(name),
          to_category:user_categories!category_rules_to_category_id_fkey(name)
        `,
        )
        .order('priority', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Toggle active mutation
  const toggleMutation = useMutation({
    mutationFn: async ({
      id,
      is_active,
    }: {
      id: string;
      is_active: boolean;
    }) => {
      const { error } = await supabase
        .from('category_rules')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-rules'] });
    },
  });

  // Update priority mutation
  const priorityMutation = useMutation({
    mutationFn: async ({ id, priority }: { id: string; priority: number }) => {
      const { error } = await supabase
        .from('category_rules')
        .update({ priority })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-rules'] });
    },
  });

  // Run all rules manually
  const runAllRules = async () => {
    setIsRunning(true);
    try {
      const { data, error } = await supabase.rpc(
        'check_all_users_category_rules',
      );
      if (error) throw error;
      toast({
        title: t('admin.users.rules.checkDone'),
        description: t('admin.users.rules.checkResult', {
          count: data || 0,
        }),
      });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (error: unknown) {
      toast({
        title: t('common.error'),
        description:
          error instanceof Error
            ? error.message
            : t('admin.users.rules.unknownError'),
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const formatConditions = (conditions: RuleConditions) => {
    if (!conditions?.rules?.length) return '—';
    return conditions.rules.map((r, i) => (
      <span key={i} className="inline-flex items-center gap-1">
        {i > 0 && (
          <span className="text-muted-foreground mx-1">
            {conditions.type === 'all'
              ? t('admin.users.rules.and')
              : t('admin.users.rules.or')}
          </span>
        )}
        <Badge variant="outline" className="font-normal">
          {fieldLabels[r.field]
            ? t(fieldLabels[r.field] as MessageKey)
            : r.field}{' '}
          {r.operator} {r.value}
        </Badge>
      </span>
    ));
  };

  const movePriority = (
    ruleId: string,
    currentPriority: number,
    direction: 'up' | 'down',
  ) => {
    const newPriority =
      direction === 'up' ? currentPriority + 1 : currentPriority - 1;
    priorityMutation.mutate({ id: ruleId, priority: newPriority });
  };

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
          <Button variant="outline" onClick={runAllRules} disabled={isRunning}>
            {isRunning ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {t('admin.users.rules.run')}
          </Button>
          <Button asChild>
            <Link
              to={adminPath('user-categories/rules/$ruleId')}
              params={{ ruleId: 'new' }}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('admin.users.rules.add')}
            </Link>
          </Button>
        </div>
      </div>

      <div className="border rounded-lg">
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
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  {t('common.loading')}
                </TableCell>
              </TableRow>
            ) : rules?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  {t('admin.users.rules.empty')}
                </TableCell>
              </TableRow>
            ) : (
              rules?.map((rule) => (
                <TableRow
                  key={rule.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() =>
                    navigate({
                      to: adminPath(`user-categories/rules/${rule.id}`),
                    })
                  }
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-sm">{rule.priority}</span>
                      <div className="flex flex-col">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() =>
                            movePriority(rule.id, rule.priority, 'up')
                          }
                        >
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() =>
                            movePriority(rule.id, rule.priority, 'down')
                          }
                        >
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{rule.name}</div>
                    {rule.description && (
                      <p className="text-sm text-muted-foreground">
                        {rule.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {rule.from_category?.name || t('admin.users.rules.any')}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <Badge>{rule.to_category?.name}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {formatConditions(
                        rule.conditions as unknown as RuleConditions,
                      )}
                    </div>
                  </TableCell>
                  <TableCell
                    className="text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({
                          id: rule.id,
                          is_active: checked,
                        })
                      }
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-sm text-muted-foreground">
        <p>
          <strong>{t('common.howItWorks')}</strong>{' '}
          {t('admin.users.rules.howItWorksText')}
        </p>
      </div>
    </div>
  );
}
