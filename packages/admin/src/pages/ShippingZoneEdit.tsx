import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { adminPath } from '../lib/adminLinks';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useSupabaseClient } from '@simplycms/supabase/SupabaseProvider';
import { useT, type Translator, type MessageKey } from '@simplycms/i18n';
import { useEngine } from '@simplycms/react-query';
import { Button } from '@simplycms/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@simplycms/ui/card';
import { Input } from '@simplycms/ui/input';
import { Textarea } from '@simplycms/ui/textarea';
import { Switch } from '@simplycms/ui/switch';
import { Badge } from '@simplycms/ui/badge';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@simplycms/ui/table';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  ShippingZone,
  ShippingRate,
  ShippingMethod,
  ShippingCalculationType,
} from '@simplycms/core/lib/shipping/types';
import { formatShippingCost } from '@simplycms/core/lib/shipping';

// Фабрика схеми: повідомлення з каталогу, транслятор живе в рендері.
const buildFormSchema = (t: Translator) =>
  z.object({
    name: z.string().min(1, t('validation.nameRequired')),
    description: z.string().optional(),
    cities: z.string().optional(),
    regions: z.string().optional(),
    is_active: z.boolean(),
    is_default: z.boolean(),
    sort_order: z.number().int().min(0),
  });

type FormValues = z.infer<ReturnType<typeof buildFormSchema>>;

// Мапа КЛЮЧІВ: тип розрахунку — enum БД, підпис резолвиться в рендері.
const calculationTypeLabels: Record<ShippingCalculationType, MessageKey> = {
  flat: 'admin.shipping.rates.calc.flat',
  weight: 'admin.shipping.rates.calc.weight',
  order_total: 'admin.shipping.rates.calc.percent',
  free_from: 'admin.shipping.rates.calc.freeFrom',
  plugin: 'admin.shipping.rates.calc.plugin',
};

// Parse comma/newline separated string into array
function parseStringToArray(str: string | undefined): string[] {
  if (!str) return [];
  return str
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Convert array to comma-separated string
function arrayToString(arr: string[] | undefined): string {
  if (!arr || arr.length === 0) return '';
  return arr.join(', ');
}

export default function ShippingZoneEdit() {
  const t = useT();
  // Локаль і валюта для `formatShippingCost` — чистої T1-функції без доступу
  // ні до конфігу магазину, ні до перекладів (див. коментар у shipping.ts).
  const { config } = useEngine();
  const supabase = useSupabaseClient();
  const { zoneId } = useParams({ strict: false }) as { zoneId: string };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = zoneId === 'new';

  const { data: zone, isLoading } = useQuery({
    queryKey: ['shipping-zone', zoneId],
    queryFn: async () => {
      if (isNew) return null;
      const { data, error } = await supabase
        .from('shipping_zones')
        .select('*')
        .eq('id', zoneId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ShippingZone;
    },
    enabled: !isNew,
  });

  const { data: rates } = useQuery({
    queryKey: ['shipping-rates', zoneId],
    queryFn: async () => {
      if (isNew) return [];
      const { data, error } = await supabase
        .from('shipping_rates')
        .select(`*, method:shipping_methods(*)`)
        .eq('zone_id', zoneId)
        .order('sort_order');
      if (error) throw error;
      return data as unknown as (ShippingRate & { method: ShippingMethod })[];
    },
    enabled: !isNew,
  });

  const { data: methods } = useQuery({
    queryKey: ['shipping-methods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipping_methods')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as unknown as ShippingMethod[];
    },
  });

  const formSchema = useMemo(() => buildFormSchema(t), [t]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      cities: '',
      regions: '',
      is_active: true,
      is_default: false,
      sort_order: 0,
    },
    values: zone
      ? {
          name: zone.name,
          description: zone.description || '',
          cities: arrayToString(zone.cities),
          regions: arrayToString(zone.regions),
          is_active: zone.is_active,
          is_default: zone.is_default,
          sort_order: zone.sort_order,
        }
      : undefined,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        name: values.name,
        description: values.description || null,
        cities: parseStringToArray(values.cities),
        regions: parseStringToArray(values.regions),
        is_active: values.is_active,
        is_default: values.is_default,
        sort_order: values.sort_order,
      };

      if (isNew) {
        const { error } = await supabase
          .from('shipping_zones')
          .insert([payload]);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('shipping_zones')
          .update(payload)
          .eq('id', zoneId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-zones'] });
      toast.success(
        isNew ? t('admin.shipping.zones.created') : t('common.changesSaved'),
      );
      if (isNew) {
        navigate({ to: adminPath('shipping/zones') });
      }
    },
    onError: (error: Error) => {
      toast.error(t('common.errorWithMessage', { message: error.message }));
    },
  });

  const deleteRate = useMutation({
    mutationFn: async (rateId: string) => {
      const { error } = await supabase
        .from('shipping_rates')
        .delete()
        .eq('id', rateId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-rates', zoneId] });
      toast.success(t('admin.shipping.rates.deleted'));
    },
    onError: () => {
      toast.error(t('admin.shipping.rates.deleteFailed'));
    },
  });

  const addRate = useMutation({
    mutationFn: async (methodId: string) => {
      const { error } = await supabase.from('shipping_rates').insert([
        {
          method_id: methodId,
          zone_id: zoneId,
          name: t('admin.shipping.rates.newName'),
          calculation_type: 'flat',
          base_cost: 0,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-rates', zoneId] });
      toast.success(t('admin.shipping.rates.added'));
    },
    onError: () => {
      toast.error(t('admin.shipping.rates.addFailed'));
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
          <h1 className="text-3xl font-bold">
            {isNew ? t('admin.shipping.zones.new') : zone?.name}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isNew
              ? t('admin.shipping.zones.newSubtitle')
              : t('admin.shipping.zones.editSubtitle')}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
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
                            placeholder={t(
                              'admin.shipping.zones.namePlaceholder',
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
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('common.description')}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t(
                              'admin.shipping.zones.descriptionPlaceholder',
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
                    name="sort_order"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t('admin.shipping.zones.priority')}
                        </FormLabel>
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
                        <FormDescription>
                          {t('admin.shipping.zones.priorityHint')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Cities and Regions */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('admin.shipping.zones.geography')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="cities"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t('admin.shipping.zones.cities')}
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t(
                              'admin.shipping.zones.citiesPlaceholder',
                            )}
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {t('admin.shipping.zones.citiesHint')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="regions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t('admin.shipping.zones.regions')}
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t(
                              'admin.shipping.zones.regionsPlaceholder',
                            )}
                            className="min-h-[60px]"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {t('admin.shipping.zones.regionsHint')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Rates Section */}
              {!isNew && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>{t('admin.shipping.rates.title')}</CardTitle>
                    <Select
                      onValueChange={(methodId) => addRate.mutate(methodId)}
                    >
                      <SelectTrigger className="w-[200px]">
                        <Plus className="h-4 w-4 mr-2" />
                        <SelectValue
                          placeholder={t('admin.shipping.rates.add')}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {methods?.map((method) => (
                          <SelectItem key={method.id} value={method.id}>
                            {method.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardHeader>
                  <CardContent>
                    {!rates?.length ? (
                      <div className="text-center py-8 text-muted-foreground">
                        {t('admin.shipping.rates.empty')}
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>
                              {t('admin.shipping.rates.methodOrName')}
                            </TableHead>
                            <TableHead>
                              {t('admin.shipping.rates.calcType')}
                            </TableHead>
                            <TableHead className="text-right">
                              {t('common.price')}
                            </TableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rates.map((rate) => (
                            <TableRow key={rate.id}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">
                                    {rate.method?.name}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {rate.name}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {t(
                                    calculationTypeLabels[
                                      rate.calculation_type
                                    ],
                                  )}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatShippingCost(rate.base_cost, config, {
                                  byTariff: t('common.shipping.byTariff'),
                                  free: t('common.shipping.free'),
                                })}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    if (
                                      confirm(
                                        t('admin.shipping.rates.confirmDelete'),
                                      )
                                    ) {
                                      deleteRate.mutate(rate.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('common.status')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div>
                          <FormLabel>{t('common.activeF')}</FormLabel>
                          <FormDescription>
                            {t('admin.shipping.zones.useForCalc')}
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

                  <FormField
                    control={form.control}
                    name="is_default"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div>
                          <FormLabel>{t('common.byDefault')}</FormLabel>
                          <FormDescription>
                            {t('admin.shipping.zones.defaultHint')}
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
