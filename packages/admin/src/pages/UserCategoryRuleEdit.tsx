import { useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSupabaseClient } from '@simplycms/supabase/SupabaseProvider';
import { useT, type Translator, type MessageKey } from '@simplycms/i18n';
import { Button } from '@simplycms/ui/button';
import { Input } from '@simplycms/ui/input';
import { Textarea } from '@simplycms/ui/textarea';
import { Switch } from '@simplycms/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@simplycms/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@simplycms/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@simplycms/ui/form';
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
import { ArrowLeft, Loader2, Trash2, Plus, X } from 'lucide-react';
import { toast } from '@simplycms/core/hooks/use-toast';
import { adminPath } from '../lib/adminLinks';

// Мапи КЛЮЧІВ: коди полів і операторів зберігаються в БД. UTM-поля мають
// латинські назви — для них ключ не потрібен, лишається сам підпис.
const conditionFields: {
  value: string;
  labelKey?: MessageKey;
  label?: string;
}[] = [
  {
    value: 'total_purchases',
    labelKey: 'admin.users.rules.field.totalPurchases',
  },
  { value: 'registration_days', labelKey: 'admin.users.daysSince' },
  { value: 'orders_count', labelKey: 'admin.users.rules.field.ordersCount' },
  { value: 'email_domain', labelKey: 'admin.users.emailDomain' },
  {
    value: 'auth_provider',
    labelKey: 'admin.users.rules.field.authProvider',
  },
  { value: 'utm_source', label: 'UTM Source' },
  { value: 'utm_campaign', label: 'UTM Campaign' },
];

// Числові оператори — математичні символи, перекладу не потребують.
const numericOperators: {
  value: string;
  labelKey?: MessageKey;
  label?: string;
}[] = [
  { value: '>=', label: '>=' },
  { value: '>', label: '>' },
  { value: '<=', label: '<=' },
  { value: '<', label: '<' },
  { value: '=', label: '=' },
];

const stringOperators: {
  value: string;
  labelKey?: MessageKey;
  label?: string;
}[] = [
  { value: '=', labelKey: 'admin.users.rules.op.equals' },
  { value: 'contains', labelKey: 'admin.users.rules.op.contains' },
];

/** Чи є поле числовим */
function isNumericField(field: string) {
  return ['total_purchases', 'registration_days', 'orders_count'].includes(
    field,
  );
}

// Фабрика схеми: повідомлення з каталогу, транслятор живе в рендері.
const buildRuleSchema = (t: Translator) =>
  z.object({
    name: z.string().min(1, t('validation.nameRequired')),
    description: z.string().optional(),
    from_category_id: z.string().nullable(),
    to_category_id: z.string().min(1, t('validation.targetCategoryRequired')),
    priority: z.coerce.number().int().min(0),
    is_active: z.boolean(),
    conditions: z.object({
      type: z.enum(['all', 'any']),
      rules: z.array(
        z.object({
          field: z.string().min(1),
          operator: z.string().min(1),
          value: z.string().min(1),
        }),
      ),
    }),
  });

type RuleFormData = z.infer<ReturnType<typeof buildRuleSchema>>;

/** Рядок умови з useWatch замість form.watch */
function ConditionRuleRow({
  control,
  index,
  onRemove,
  setValue,
}: {
  control: ReturnType<typeof useForm<RuleFormData>>['control'];
  index: number;
  onRemove: () => void;
  setValue: ReturnType<typeof useForm<RuleFormData>>['setValue'];
}) {
  const t = useT();
  const fieldValue = useWatch({
    control,
    name: `conditions.rules.${index}.field`,
  });
  const operators = isNumericField(fieldValue)
    ? numericOperators
    : stringOperators;

  return (
    <div className="flex items-start gap-2 p-4 border rounded-lg">
      <FormField
        control={control}
        name={`conditions.rules.${index}.field`}
        render={({ field }) => (
          <FormItem className="flex-1">
            <Select
              value={field.value}
              onValueChange={(v) => {
                field.onChange(v);
                setValue(
                  `conditions.rules.${index}.operator`,
                  isNumericField(v) ? '>=' : '=',
                );
              }}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder={t('admin.users.rules.field')} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {conditionFields.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.labelKey ? t(f.labelKey) : f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name={`conditions.rules.${index}.operator`}
        render={({ field }) => (
          <FormItem className="w-32">
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder={t('admin.users.rules.operator')} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {operators.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.labelKey ? t(op.labelKey) : op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name={`conditions.rules.${index}.value`}
        render={({ field }) => (
          <FormItem className="flex-1">
            <FormControl>
              <Input
                type={isNumericField(fieldValue) ? 'number' : 'text'}
                placeholder={t('common.value')}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function UserCategoryRuleEdit() {
  const t = useT();
  const supabase = useSupabaseClient();
  const { ruleId } = useParams({ strict: false }) as { ruleId: string };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !ruleId || ruleId === 'new';

  const ruleSchema = useMemo(() => buildRuleSchema(t), [t]);

  const form = useForm<RuleFormData>({
    // zodResolver + z.coerce.number() спричиняє TFieldValues mismatch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(ruleSchema) as any,
    defaultValues: {
      name: '',
      description: '',
      from_category_id: null,
      to_category_id: '',
      priority: 0,
      is_active: true,
      conditions: {
        type: 'all',
        rules: [],
      },
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'conditions.rules',
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['user-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_categories')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch rule
  const { data: rule, isLoading } = useQuery({
    queryKey: ['category-rule', ruleId],
    queryFn: async () => {
      if (isNew || !ruleId) return null;
      const { data, error } = await supabase
        .from('category_rules')
        .select('*')
        .eq('id', ruleId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !isNew && !!ruleId,
  });

  // Fill form when rule loads
  useEffect(() => {
    if (rule) {
      const conditions = rule.conditions as {
        type: 'all' | 'any';
        rules: Array<{ field: string; operator: string; value: string }>;
      };
      form.reset({
        name: rule.name,
        description: rule.description || '',
        from_category_id: rule.from_category_id,
        to_category_id: rule.to_category_id,
        priority: rule.priority,
        is_active: rule.is_active,
        conditions: {
          type: conditions?.type || 'all',
          rules:
            conditions?.rules?.map((r) => ({
              field: r.field,
              operator: r.operator,
              value: String(r.value),
            })) || [],
        },
      });
    }
  }, [rule, form]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: RuleFormData) => {
      const payload = {
        name: data.name,
        description: data.description || null,
        from_category_id: data.from_category_id || null,
        to_category_id: data.to_category_id,
        priority: data.priority,
        is_active: data.is_active,
        conditions: data.conditions,
      };

      if (isNew) {
        const { error } = await supabase.from('category_rules').insert(payload);
        if (error) throw error;
      } else {
        if (!ruleId) throw new Error('Rule ID is required for update');
        const { error } = await supabase
          .from('category_rules')
          .update(payload)
          .eq('id', ruleId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-rules'] });
      queryClient.invalidateQueries({ queryKey: ['user-categories'] });
      toast({
        title: isNew
          ? t('admin.users.rules.created')
          : t('common.changesSaved'),
      });
      navigate({ to: adminPath('user-categories/rules') });
    },
    onError: (error: Error) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!ruleId) throw new Error('Rule ID is required for delete');
      const { error } = await supabase
        .from('category_rules')
        .delete()
        .eq('id', ruleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-rules'] });
      queryClient.invalidateQueries({ queryKey: ['user-categories'] });
      toast({ title: t('admin.users.rules.deleted') });
      navigate({ to: adminPath('user-categories/rules') });
    },
    onError: (error: Error) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  if (!isNew && isLoading) {
    return <div className="p-8 text-center">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={adminPath('user-categories/rules')}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">
            {isNew
              ? t('admin.users.rules.new')
              : t('admin.users.rules.editTitle')}
          </h1>
        </div>
        {!isNew && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t('admin.users.rules.deleteTitle')}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t('admin.users.categories.deleteWarning')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate()}
                  className="bg-destructive text-destructive-foreground"
                >
                  {t('common.delete')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))}
          className="space-y-6"
        >
          <Card>
            <CardHeader>
              <CardTitle>{t('common.basicInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.users.rules.nameLabel')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('admin.users.rules.namePlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.description')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t(
                          'admin.users.rules.descriptionPlaceholder',
                        )}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.priority')}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormDescription>
                        {t('admin.users.rules.priorityHint')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>{t('common.activeN')}</FormLabel>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('admin.users.rules.transitionSection')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="from_category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('admin.users.rules.fromCategory')}
                      </FormLabel>
                      <Select
                        value={field.value || 'any'}
                        onValueChange={(v) =>
                          field.onChange(v === 'any' ? null : v)
                        }
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t('admin.users.rules.any')}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="any">
                            {t('admin.users.rules.anyCategory')}
                          </SelectItem>
                          {categories?.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="to_category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.users.rules.toCategory')}</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t('admin.users.pickCategory')}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories?.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{t('admin.users.rules.conditions')}</CardTitle>
              <FormField
                control={form.control}
                name="conditions.type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-45">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t('admin.users.rules.allConditions')}
                      </SelectItem>
                      <SelectItem value="any">
                        {t('admin.users.rules.anyCondition')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  {t('admin.users.rules.addAtLeastOne')}
                </p>
              )}

              {fields.map((item, index) => (
                <ConditionRuleRow
                  key={item.id}
                  control={form.control}
                  index={index}
                  onRemove={() => remove(index)}
                  setValue={form.setValue}
                />
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  append({
                    field: 'total_purchases',
                    operator: '>=',
                    value: '',
                  })
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('admin.users.rules.addCondition')}
              </Button>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button variant="outline" asChild>
              <Link to={adminPath('user-categories/rules')}>
                {t('common.cancel')}
              </Link>
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isNew ? t('common.create') : t('common.save')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
