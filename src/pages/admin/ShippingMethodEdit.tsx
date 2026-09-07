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
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ShippingMethod } from "@/lib/shipping/types";
import { PluginSlot } from "@/components/plugins/PluginSlot";

const formSchema = z.object({
  code: z.string().min(1, "Код обов'язковий").max(50),
  name: z.string().min(1, "Назва обов'язкова"),
  description: z.string().optional(),
  type: z.enum(["system", "manual", "plugin"]),
  plugin_name: z.string().optional(),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0),
  icon: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function ShippingMethodEdit() {
  const { methodId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = methodId === "new";

  const { data: method, isLoading } = useQuery({
    queryKey: ["shipping-method", methodId],
    queryFn: async () => {
      if (isNew) return null;
      const { data, error } = await supabase
        .from("shipping_methods")
        .select("*")
        .eq("id", methodId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ShippingMethod;
    },
    enabled: !isNew,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      type: "manual",
      plugin_name: "",
      is_active: true,
      sort_order: 0,
      icon: "",
    },
    values: method
      ? {
          code: method.code,
          name: method.name,
          description: method.description || "",
          type: method.type,
          plugin_name: method.plugin_name || "",
          is_active: method.is_active,
          sort_order: method.sort_order,
          icon: method.icon || "",
        }
      : undefined,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        code: values.code,
        name: values.name,
        description: values.description || null,
        type: values.type,
        plugin_name: values.type === "plugin" ? values.plugin_name || null : null,
        is_active: values.is_active,
        sort_order: values.sort_order,
        icon: values.icon || null,
      };

      if (isNew) {
        const { error } = await supabase.from("shipping_methods").insert([payload]);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("shipping_methods")
          .update(payload)
          .eq("id", methodId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-methods"] });
      toast.success(isNew ? "Службу створено" : "Зміни збережено");
      navigate("/admin/shipping/methods");
    },
    onError: (error: Error) => {
      toast.error(`Помилка: ${error.message}`);
    },
  });

  const methodType = form.watch("type");
  const isSystem = method?.type === "system";

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
            {isNew ? "Нова служба доставки" : method?.name}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isNew
              ? "Створіть новий спосіб доставки"
              : "Редагування параметрів служби доставки"}
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
                          <Input placeholder="Кур'єрська доставка" {...field} />
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
                        <FormLabel>Код</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="courier"
                            {...field}
                            disabled={isSystem}
                          />
                        </FormControl>
                        <FormDescription>
                          Унікальний ідентифікатор для системи
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
                        <FormLabel>Опис</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Доставка кур'єром за вашою адресою"
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
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Тип</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={isSystem}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="system">Системний</SelectItem>
                              <SelectItem value="manual">Ручний</SelectItem>
                              <SelectItem value="plugin">Плагін</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {methodType === "plugin" && (
                      <FormField
                        control={form.control}
                        name="plugin_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Назва плагіна</FormLabel>
                            <FormControl>
                              <Input placeholder="nova_poshta" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="icon"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Іконка (Lucide)</FormLabel>
                          <FormControl>
                            <Input placeholder="Truck" {...field} />
                          </FormControl>
                          <FormDescription>
                            Назва іконки з бібліотеки Lucide
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
                          <FormLabel>Порядок сортування</FormLabel>
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

              {/* Plugin settings slot */}
              {methodType === "plugin" && method && (
                <PluginSlot
                  name="admin.shipping.method.settings"
                  context={{ method }}
                />
              )}
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Статус</CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div>
                          <FormLabel>Активна</FormLabel>
                          <FormDescription>
                            Відображати на сторінці оформлення замовлення
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
