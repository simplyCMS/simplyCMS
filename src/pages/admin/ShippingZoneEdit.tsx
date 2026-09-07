import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { ShippingZone, ShippingRate, ShippingMethod, ShippingCalculationType } from "@/lib/shipping/types";
import { formatShippingCost } from "@/lib/shipping";

const formSchema = z.object({
  name: z.string().min(1, "Назва обов'язкова"),
  description: z.string().optional(),
  cities: z.string().optional(),
  regions: z.string().optional(),
  is_active: z.boolean(),
  is_default: z.boolean(),
  sort_order: z.number().int().min(0),
});

type FormValues = z.infer<typeof formSchema>;

const calculationTypeLabels: Record<ShippingCalculationType, string> = {
  flat: "Фіксована ціна",
  weight: "За вагою",
  order_total: "Відсоток від суми",
  free_from: "Безкоштовно від суми",
  plugin: "Розрахунок плагіном",
};

// Parse comma/newline separated string into array
function parseStringToArray(str: string | undefined): string[] {
  if (!str) return [];
  return str
    .split(/[,\n]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

// Convert array to comma-separated string
function arrayToString(arr: string[] | undefined): string {
  if (!arr || arr.length === 0) return "";
  return arr.join(", ");
}

export default function ShippingZoneEdit() {
  const { zoneId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = zoneId === "new";

  const { data: zone, isLoading } = useQuery({
    queryKey: ["shipping-zone", zoneId],
    queryFn: async () => {
      if (isNew) return null;
      const { data, error } = await supabase
        .from("shipping_zones")
        .select("*")
        .eq("id", zoneId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ShippingZone;
    },
    enabled: !isNew,
  });

  const { data: rates } = useQuery({
    queryKey: ["shipping-rates", zoneId],
    queryFn: async () => {
      if (isNew) return [];
      const { data, error } = await supabase
        .from("shipping_rates")
        .select(`*, method:shipping_methods(*)`)
        .eq("zone_id", zoneId)
        .order("sort_order");
      if (error) throw error;
      return data as unknown as (ShippingRate & { method: ShippingMethod })[];
    },
    enabled: !isNew,
  });

  const { data: methods } = useQuery({
    queryKey: ["shipping-methods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_methods")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as unknown as ShippingMethod[];
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      cities: "",
      regions: "",
      is_active: true,
      is_default: false,
      sort_order: 0,
    },
    values: zone
      ? {
          name: zone.name,
          description: zone.description || "",
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
        const { error } = await supabase.from("shipping_zones").insert([payload]);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("shipping_zones")
          .update(payload)
          .eq("id", zoneId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-zones"] });
      toast.success(isNew ? "Зону створено" : "Зміни збережено");
      if (isNew) {
        navigate("/admin/shipping/zones");
      }
    },
    onError: (error: Error) => {
      toast.error(`Помилка: ${error.message}`);
    },
  });

  const deleteRate = useMutation({
    mutationFn: async (rateId: string) => {
      const { error } = await supabase.from("shipping_rates").delete().eq("id", rateId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-rates", zoneId] });
      toast.success("Тариф видалено");
    },
    onError: () => {
      toast.error("Помилка видалення тарифу");
    },
  });

  const addRate = useMutation({
    mutationFn: async (methodId: string) => {
      const { error } = await supabase.from("shipping_rates").insert([{
        method_id: methodId,
        zone_id: zoneId,
        name: "Новий тариф",
        calculation_type: "flat",
        base_cost: 0,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-rates", zoneId] });
      toast.success("Тариф додано");
    },
    onError: () => {
      toast.error("Помилка додавання тарифу");
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
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {isNew ? "Нова зона доставки" : zone?.name}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isNew
              ? "Створіть нову географічну зону"
              : "Редагування зони та тарифів доставки"}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Основна інформація</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Назва</FormLabel>
                        <FormControl>
                          <Input placeholder="Київ і передмістя" {...field} />
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
                        <FormLabel>Опис</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Зона доставки для Києва та околиць"
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
                        <FormLabel>Пріоритет (порядок)</FormLabel>
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
                          Менший номер = вищий пріоритет при визначенні зони
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
                  <CardTitle>Географія</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="cities"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Міста</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Київ, Бровари, Вишневе, Ірпінь"
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Введіть назви міст через кому або кожне місто з нового рядка
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
                        <FormLabel>Регіони (опціонально)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Київська область"
                            className="min-h-[60px]"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Якщо потрібно, вкажіть регіони/області
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
                    <CardTitle>Тарифи доставки</CardTitle>
                    <Select onValueChange={(methodId) => addRate.mutate(methodId)}>
                      <SelectTrigger className="w-[200px]">
                        <Plus className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Додати тариф" />
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
                        Тарифи не налаштовано. Додайте тариф для кожного способу доставки.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Спосіб / Назва</TableHead>
                            <TableHead>Тип розрахунку</TableHead>
                            <TableHead className="text-right">Ціна</TableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rates.map((rate) => (
                            <TableRow key={rate.id}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{rate.method?.name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {rate.name}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {calculationTypeLabels[rate.calculation_type]}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatShippingCost(rate.base_cost)}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    if (confirm("Видалити цей тариф?")) {
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
                  <CardTitle>Статус</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div>
                          <FormLabel>Активна</FormLabel>
                          <FormDescription>
                            Використовувати зону для розрахунку
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
                          <FormLabel>За замовчуванням</FormLabel>
                          <FormDescription>
                            Застосовується, якщо місто не знайдено
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
                    {isNew ? "Створити" : "Зберегти"}
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
