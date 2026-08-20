import { useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { adminPath } from '../lib/adminLinks';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@simplycms/ui/button';
import { Input } from '@simplycms/ui/input';
import { Textarea } from '@simplycms/ui/textarea';
import { Switch } from '@simplycms/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@simplycms/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@simplycms/ui/card';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@simplycms/ui/form';
import { useSupabaseClient } from 'simplycms/supabase/SupabaseProvider';
import { useT, type Translator } from 'simplycms/i18n';
import { toast } from '@simplycms/core/hooks/use-toast';

// Фабрика схеми: повідомлення з каталогу.
const buildSchema = (t: Translator) =>
  z.object({
    name: z.string().min(1, t('validation.nameRequired')),
    description: z.string().optional(),
    operator: z.enum(['and', 'or', 'not', 'min', 'max']),
    parent_group_id: z.string().optional(),
    is_active: z.boolean(),
    priority: z.number().int(),
    starts_at: z.string().optional(),
    ends_at: z.string().optional(),
  });

type FormData = z.infer<ReturnType<typeof buildSchema>>;

export default function DiscountGroupEdit() {
  const t = useT();
  const supabase = useSupabaseClient();
  const { groupId } = useParams({ strict: false }) as { groupId: string };
  const search = useSearch({ strict: false }) as Record<string, string>;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !groupId || groupId === 'new';

  const schema = useMemo(() => buildSchema(t), [t]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      description: '',
      operator: 'and',
      parent_group_id: search.parentId || '',
      is_active: true,
      priority: 0,
      starts_at: '',
      ends_at: '',
    },
  });

  const { data: parentGroups = [] } = useQuery({
    queryKey: ['discount-groups-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discount_groups')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data.filter((g) => g.id !== groupId);
    },
  });

  const { data: existing } = useQuery({
    queryKey: ['discount-group', groupId],
    queryFn: async () => {
      if (isNew) return null;
      const { data, error } = await supabase
        .from('discount_groups')
        .select('*')
        .eq('id', groupId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !isNew,
  });

  useEffect(() => {
    if (existing) {
      form.reset({
        name: existing.name,
        description: existing.description || '',
        operator: existing.operator as FormData['operator'],
        parent_group_id: existing.parent_group_id || '',
        is_active: existing.is_active,
        priority: existing.priority,
        starts_at: existing.starts_at ? existing.starts_at.slice(0, 16) : '',
        ends_at: existing.ends_at ? existing.ends_at.slice(0, 16) : '',
      });
    }
  }, [existing, form]);

  const save = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        name: data.name,
        description: data.description || null,
        operator: data.operator,
        parent_group_id:
          data.parent_group_id && data.parent_group_id !== '__root__'
            ? data.parent_group_id
            : null,
        is_active: data.is_active,
        priority: data.priority,
        starts_at: data.starts_at || null,
        ends_at: data.ends_at || null,
      };

      if (isNew) {
        const { error } = await supabase
          .from('discount_groups')
          .insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('discount_groups')
          .update(payload)
          .eq('id', groupId!);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-groups-tree'] });
      toast({
        title: isNew
          ? t('admin.discounts.groupCreated')
          : t('admin.discounts.groupUpdated'),
      });
      navigate({ to: adminPath('discounts') });
    },
    onError: (err: Error) => {
      toast({
        title: t('common.error'),
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: adminPath('discounts') })}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-3xl font-bold">
          {isNew
            ? t('admin.discounts.groupNew')
            : t('admin.discounts.groupEditTitle')}
        </h1>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((d) => save.mutate(d))}
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
                    <FormLabel>{t('common.name')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('admin.discounts.groupNamePlaceholder')}
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
                      <Textarea {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="operator"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.discounts.opLabel')}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="and">
                            {t('admin.discounts.op.andLong')}
                          </SelectItem>
                          <SelectItem value="or">
                            {t('admin.discounts.op.orLong')}
                          </SelectItem>
                          <SelectItem value="not">
                            {t('admin.discounts.op.notLong')}
                          </SelectItem>
                          <SelectItem value="min">
                            {t('admin.discounts.op.minLong')}
                          </SelectItem>
                          <SelectItem value="max">
                            {t('admin.discounts.op.maxLong')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="parent_group_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.discounts.parentGroup')}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || '__root__'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t('admin.discounts.rootLevel')}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__root__">
                          {t('admin.discounts.rootLevel')}
                        </SelectItem>
                        {parentGroups.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.discounts.priorityLabel')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="starts_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.dateFrom')}</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ends_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.dateTo')}</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">
                      {t('common.activeF')}
                    </FormLabel>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? t('common.saving') : t('common.save')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: adminPath('discounts') })}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
