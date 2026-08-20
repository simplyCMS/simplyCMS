import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { adminPath } from '../lib/adminLinks';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useSupabaseClient } from 'simplycms/supabase/SupabaseProvider';
import { useT, type Translator } from 'simplycms/i18n';
import { Button } from '@simplycms/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@simplycms/ui/card';
import { Badge } from '@simplycms/ui/badge';
import { Input } from '@simplycms/ui/input';
import { Switch } from '@simplycms/ui/switch';
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
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Shield } from 'lucide-react';
import {
  PickupPoint,
  ShippingMethod,
  ShippingZone,
} from '@simplycms/core/lib/shipping/types';

// Фабрика схеми: повідомлення з каталогу, транслятор живе в рендері.
const buildFormSchema = (t: Translator) =>
  z.object({
    name: z.string().min(1, t('validation.nameRequired')),
    city: z.string().min(1, t('validation.cityRequired')),
    address: z.string().min(1, t('validation.addressRequired')),
    phone: z.string().optional(),
    zone_id: z.string().optional(),
    is_active: z.boolean(),
    sort_order: z.number().int().min(0),
  });

type FormValues = z.infer<ReturnType<typeof buildFormSchema>>;

export default function PickupPointEdit() {
  const t = useT();
  const supabase = useSupabaseClient();
  const { pointId } = useParams({ strict: false }) as { pointId: string };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = pointId === 'new';

  const { data: point, isLoading } = useQuery({
    queryKey: ['pickup-point', pointId],
    queryFn: async () => {
      if (isNew) return null;
      const { data, error } = await supabase
        .from('pickup_points')
        .select('*')
        .eq('id', pointId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as PickupPoint;
    },
    enabled: !isNew,
  });

  const { data: pickupMethod } = useQuery({
    queryKey: ['pickup-method'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipping_methods')
        .select('*')
        .eq('code', 'pickup')
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ShippingMethod;
    },
  });

  const { data: zones } = useQuery({
    queryKey: ['shipping-zones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipping_zones')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as unknown as ShippingZone[];
    },
  });

  const formSchema = useMemo(() => buildFormSchema(t), [t]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      city: '',
      address: '',
      phone: '',
      zone_id: '',
      is_active: true,
      sort_order: 0,
    },
    values: point
      ? {
          name: point.name,
          city: point.city,
          address: point.address,
          phone: point.phone || '',
          zone_id: point.zone_id || '',
          is_active: point.is_active,
          sort_order: point.sort_order,
        }
      : undefined,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!pickupMethod)
        throw new Error(t('admin.shipping.points.methodMissing'));

      const payload = {
        method_id: pickupMethod.id,
        name: values.name,
        city: values.city,
        address: values.address,
        phone: values.phone || null,
        zone_id: values.zone_id || null,
        is_active: values.is_active,
        sort_order: values.sort_order,
      };

      if (isNew) {
        const { error } = await supabase
          .from('pickup_points')
          .insert([payload]);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pickup_points')
          .update(payload)
          .eq('id', pointId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pickup-points'] });
      if (!isNew) {
        queryClient.invalidateQueries({ queryKey: ['pickup-point', pointId] });
      }
      toast.success(
        isNew ? t('admin.shipping.points.created') : t('common.changesSaved'),
      );
      navigate({ to: adminPath('shipping/pickup-points') });
    },
    onError: (error: Error) => {
      toast.error(t('common.errorWithMessage', { message: error.message }));
    },
  });

  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => window.history.back()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">
              {isNew ? t('admin.shipping.points.new') : point?.name}
            </h1>
            {point?.is_system && (
              <Badge variant="secondary" className="gap-1">
                <Shield className="h-3 w-3" />
                {t('admin.shipping.points.system')}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            {isNew
              ? t('admin.shipping.points.newSubtitle')
              : point?.is_system
                ? t('admin.shipping.points.systemLocked')
                : t('admin.shipping.points.editSubtitle')}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('admin.shipping.points.info')}</CardTitle>
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
                            placeholder={t(
                              'admin.shipping.points.namePlaceholder',
                            )}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('common.city')}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t(
                                'admin.shipping.points.cityPlaceholder',
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
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('common.phone')}</FormLabel>
                          <FormControl>
                            <Input placeholder="+380 44 123 45 67" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('common.address')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t(
                              'admin.shipping.points.addressPlaceholder',
                            )}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="zone_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t('admin.shipping.points.zoneLabel')}
                          </FormLabel>
                          <Select
                            onValueChange={(val) =>
                              field.onChange(val === 'none' ? '' : val)
                            }
                            value={field.value || 'none'}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={t(
                                    'admin.shipping.points.zonePlaceholder',
                                  )}
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">
                                {t('admin.shipping.points.noZone')}
                              </SelectItem>
                              {zones?.map((zone) => (
                                <SelectItem key={zone.id} value={zone.id}>
                                  {zone.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            {t('admin.shipping.points.zoneHint')}
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
                          <FormLabel>{t('common.order')}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value) || 0)
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('common.status')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div>
                          <FormLabel>{t('common.activeF')}</FormLabel>
                          <FormDescription>
                            {t('admin.shipping.points.showAtCheckout')}
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
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={saveMutation.isPending}
                  >
                    {saveMutation.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {isNew ? t('common.create') : t('common.save')}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
