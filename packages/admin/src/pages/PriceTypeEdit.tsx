import { useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSupabaseClient } from 'simplycms/supabase/SupabaseProvider';
import { useT, type Translator } from 'simplycms/i18n';
import { Button } from '@simplycms/ui/button';
import { Input } from '@simplycms/ui/input';
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
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react';
import { toast } from '@simplycms/core/hooks/use-toast';
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

// Фабрика схеми: повідомлення з каталогу, транслятор живе в рендері.
const buildSchema = (t: Translator) =>
  z.object({
    name: z.string().min(1, t('validation.nameRequired')),
    code: z
      .string()
      .min(1, t('validation.codeRequired'))
      .regex(/^[a-z0-9_]+$/, t('validation.slug')),
    sort_order: z.coerce.number().int().min(0),
    is_default: z.boolean(),
  });

type FormData = z.infer<ReturnType<typeof buildSchema>>;

export default function PriceTypeEdit() {
  const t = useT();
  const supabase = useSupabaseClient();
  const { priceTypeId } = useParams({ strict: false }) as {
    priceTypeId: string;
  };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !priceTypeId || priceTypeId === 'new';

  const schema = useMemo(() => buildSchema(t), [t]);

  const form = useForm<FormData>({
    // zodResolver + z.coerce.number() спричиняє TFieldValues mismatch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: { name: '', code: '', sort_order: 0, is_default: false },
  });

  const { data: priceType, isLoading } = useQuery({
    queryKey: ['price-type', priceTypeId],
    queryFn: async () => {
      if (isNew || !priceTypeId) return null;
      const { data, error } = await supabase
        .from('price_types')
        .select('*')
        .eq('id', priceTypeId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !isNew && !!priceTypeId,
  });

  useEffect(() => {
    if (priceType) {
      form.reset({
        name: priceType.name,
        code: priceType.code,
        sort_order: priceType.sort_order,
        is_default: priceType.is_default,
      });
    }
  }, [priceType, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (data.is_default) {
        await supabase
          .from('price_types')
          .update({ is_default: false })
          .neq('id', priceTypeId || '');
      }
      if (isNew) {
        const { error } = await supabase.from('price_types').insert({
          name: data.name,
          code: data.code,
          sort_order: data.sort_order,
          is_default: data.is_default,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('price_types')
          .update(data)
          .eq('id', priceTypeId!);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-price-types'] });
      queryClient.invalidateQueries({ queryKey: ['price-types'] });
      toast({
        title: isNew ? t('admin.prices.created') : t('common.changesSaved'),
      });
      navigate({ to: adminPath('price-types') });
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
      const { error } = await supabase
        .from('price_types')
        .delete()
        .eq('id', priceTypeId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-price-types'] });
      toast({ title: t('admin.prices.deleted') });
      navigate({ to: adminPath('price-types') });
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
            <Link to={adminPath('price-types')}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">
            {isNew ? t('admin.prices.new') : t('admin.prices.editTitle')}
          </h1>
        </div>
        {!isNew && !priceType?.is_default && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t('admin.prices.deleteTitle')}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t('admin.prices.deleteWarning')}
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
          <CardTitle>{t('common.information')}</CardTitle>
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
                        placeholder={t('admin.prices.namePlaceholder')}
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
                      {t('admin.prices.codeHint')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sort_order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.sortOrder')}</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} />
                    </FormControl>
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
                        {t('admin.prices.defaultHint')}
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
                  <Link to={adminPath('price-types')}>
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
