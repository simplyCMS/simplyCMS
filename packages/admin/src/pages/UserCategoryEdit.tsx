import { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import { adminPath } from '../lib/adminLinks';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSupabaseClient } from '@simplycms/supabase/SupabaseProvider';
import { useT, type Translator } from '@simplycms/i18n';
import { Button } from '@simplycms/ui/button';
import { Input } from '@simplycms/ui/input';
import { Textarea } from '@simplycms/ui/textarea';
import { Switch } from '@simplycms/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@simplycms/ui/card';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@simplycms/ui/select';
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react';
import { toast } from '@simplycms/core/hooks/use-toast';
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

// Фабрика схеми: повідомлення з каталогу, транслятор живе в рендері.
const buildCategorySchema = (t: Translator) =>
  z.object({
    name: z.string().min(1, t('validation.nameRequired')),
    code: z
      .string()
      .min(1, t('validation.codeRequired'))
      .regex(/^[a-z0-9_]+$/, t('validation.slug')),
    description: z.string().optional(),
    price_type_id: z.string().optional().nullable(),
    is_default: z.boolean(),
  });

type CategoryFormData = z.infer<ReturnType<typeof buildCategorySchema>>;

export default function UserCategoryEdit() {
  const t = useT();
  const supabase = useSupabaseClient();
  const { categoryId } = useParams({ strict: false }) as { categoryId: string };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !categoryId || categoryId === 'new';

  const categorySchema = useMemo(() => buildCategorySchema(t), [t]);

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      price_type_id: null,
      is_default: false,
    },
  });

  const { data: category, isLoading } = useQuery({
    queryKey: ['user-category', categoryId],
    queryFn: async () => {
      if (isNew || !categoryId) return null;
      const { data, error } = await supabase
        .from('user_categories')
        .select('*')
        .eq('id', categoryId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !isNew && !!categoryId,
  });

  const { data: priceTypes } = useQuery({
    queryKey: ['price-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_types')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (category) {
      form.reset({
        name: category.name,
        code: category.code,
        description: category.description || '',
        price_type_id: category.price_type_id || null,
        is_default: category.is_default,
      });
    }
  }, [category, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: CategoryFormData) => {
      if (data.is_default) {
        await supabase
          .from('user_categories')
          .update({ is_default: false })
          .neq('id', categoryId || '');
      }
      const payload = {
        name: data.name,
        code: data.code,
        description: data.description || null,
        price_type_id: data.price_type_id || null,
        is_default: data.is_default,
      };
      if (isNew) {
        const { error } = await supabase
          .from('user_categories')
          .insert(payload);
        if (error) throw error;
      } else {
        if (!categoryId) throw new Error('Category ID is required');
        const { error } = await supabase
          .from('user_categories')
          .update(payload)
          .eq('id', categoryId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-categories'] });
      queryClient.invalidateQueries({
        queryKey: ['user-categories-with-counts'],
      });
      toast({
        title: isNew
          ? t('admin.users.categories.created')
          : t('common.changesSaved'),
      });
      navigate({ to: adminPath('user-categories') });
    },
    onError: (error: Error) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!categoryId) throw new Error('Category ID required');
      const { error } = await supabase
        .from('user_categories')
        .delete()
        .eq('id', categoryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-categories'] });
      queryClient.invalidateQueries({
        queryKey: ['user-categories-with-counts'],
      });
      toast({ title: t('admin.users.categories.deleted') });
      navigate({ to: adminPath('user-categories') });
    },
    onError: (error: Error) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  if (!isNew && isLoading)
    return <div className="p-8 text-center">{t('common.loading')}</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={adminPath('user-categories')}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">
            {isNew
              ? t('admin.users.categories.new')
              : t('admin.users.categories.editTitle')}
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
                  {t('admin.users.categories.deleteTitle')}
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

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.users.categories.info')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))}
              className="space-y-6"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.name')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t(
                          'admin.users.categories.namePlaceholder',
                        )}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.code')}</FormLabel>
                    <FormControl>
                      <Input placeholder="retail" {...field} />
                    </FormControl>
                    <FormDescription>
                      {t('admin.users.categories.codeHint')}
                    </FormDescription>
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
                          'admin.users.categories.descriptionPlaceholder',
                        )}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="price_type_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.users.priceType')}</FormLabel>
                    <Select
                      value={field.value || '__none__'}
                      onValueChange={(v) =>
                        field.onChange(v === '__none__' ? null : v)
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t(
                              'admin.users.categories.defaultPriceType',
                            )}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">
                          {t('common.byDefault')}
                        </SelectItem>
                        {priceTypes?.map((pt) => (
                          <SelectItem key={pt.id} value={pt.id}>
                            {pt.name}{' '}
                            {pt.is_default
                              ? t('admin.users.categories.defaultSuffix')
                              : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t('admin.users.categories.priceTypeHint')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="is_default"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        {t('common.byDefault')}
                      </FormLabel>
                      <FormDescription>
                        {t('admin.users.categories.isDefaultHint')}
                      </FormDescription>
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
              <div className="flex justify-end gap-4">
                <Button variant="outline" asChild>
                  <Link to={adminPath('user-categories')}>
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
        </CardContent>
      </Card>
    </div>
  );
}
