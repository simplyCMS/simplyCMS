import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const schema = z.object({
  name: z.string().min(1, "Назва обов'язкова"),
  description: z.string().optional(),
  group_id: z.string().min(1, "Оберіть групу"),
  price_type_id: z.string().min(1, "Оберіть вид ціни"),
  discount_type: z.enum(["percent", "fixed_amount", "fixed_price"]),
  discount_value: z.number().positive("Значення має бути додатнім"),
  priority: z.number().int(),
  is_active: z.boolean(),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface TargetRow {
  id?: string;
  target_type: string;
  target_id: string | null;
  _label?: string;
}

interface ConditionRow {
  id?: string;
  condition_type: string;
  operator: string;
  value: any;
}

const conditionTypeLabels: Record<string, string> = {
  user_category: "Категорія користувача",
  min_quantity: "Мін. кількість",
  min_order_amount: "Мін. сума замовлення",
  user_logged_in: "Авторизований",
};

export default function DiscountEdit() {
  const { discountId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !discountId || discountId === "new";

  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [conditions, setConditions] = useState<ConditionRow[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      group_id: searchParams.get("groupId") || "",
      price_type_id: searchParams.get("priceTypeId") || "",
      discount_type: "percent",
      discount_value: 10,
      priority: 0,
      is_active: true,
      starts_at: "",
      ends_at: "",
    },
  });

  // Load reference data
  const { data: groups = [] } = useQuery({
    queryKey: ["discount-groups-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("discount_groups").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: priceTypes = [] } = useQuery({
    queryKey: ["price-types"],
    queryFn: async () => {
      const { data, error } = await supabase.from("price_types").select("id, name").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-list-simple"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name").order("name").limit(500);
      if (error) throw error;
      return data;
    },
  });

  const { data: sections = [] } = useQuery({
    queryKey: ["sections-list-simple"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sections").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: userCategories = [] } = useQuery({
    queryKey: ["user-categories-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_categories").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Load existing discount
  const { data: existing } = useQuery({
    queryKey: ["discount", discountId],
    queryFn: async () => {
      if (isNew) return null;
      const { data, error } = await supabase.from("discounts").select("*").eq("id", discountId!).single();
      if (error) throw error;

      const { data: t } = await supabase.from("discount_targets").select("*").eq("discount_id", discountId!);
      const { data: c } = await supabase.from("discount_conditions").select("*").eq("discount_id", discountId!);

      return { ...data, targets: t || [], conditions: c || [] };
    },
    enabled: !isNew,
  });

  useEffect(() => {
    if (existing) {
      form.reset({
        name: existing.name,
        description: existing.description || "",
        group_id: existing.group_id,
        price_type_id: existing.price_type_id,
        discount_type: existing.discount_type as any,
        discount_value: Number(existing.discount_value),
        priority: existing.priority,
        is_active: existing.is_active,
        starts_at: existing.starts_at ? existing.starts_at.slice(0, 16) : "",
        ends_at: existing.ends_at ? existing.ends_at.slice(0, 16) : "",
      });
      setTargets(existing.targets || []);
      setConditions(existing.conditions || []);
    }
  }, [existing, form]);

  const save = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        name: data.name,
        description: data.description || null,
        group_id: data.group_id,
        price_type_id: data.price_type_id,
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        priority: data.priority,
        is_active: data.is_active,
        starts_at: data.starts_at || null,
        ends_at: data.ends_at || null,
      };

      let id = discountId;
      if (isNew) {
        const { data: created, error } = await supabase.from("discounts").insert(payload).select("id").single();
        if (error) throw error;
        id = created.id;
      } else {
        const { error } = await supabase.from("discounts").update(payload).eq("id", id!);
        if (error) throw error;
      }

      // Sync targets
      await supabase.from("discount_targets").delete().eq("discount_id", id!);
      if (targets.length > 0) {
        const { error } = await supabase.from("discount_targets").insert(
          targets.map((t) => ({ discount_id: id!, target_type: t.target_type as "all" | "product" | "section" | "modification", target_id: t.target_id }))
        );
        if (error) throw error;
      }

      // Sync conditions
      await supabase.from("discount_conditions").delete().eq("discount_id", id!);
      if (conditions.length > 0) {
        const { error } = await supabase.from("discount_conditions").insert(
          conditions.map((c) => ({
            discount_id: id!,
            condition_type: c.condition_type,
            operator: c.operator,
            value: c.value,
          }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discount-groups-tree"] });
      toast({ title: isNew ? "Скидку створено" : "Скидку оновлено" });
      navigate("/admin/discounts");
    },
    onError: (err: any) => {
      toast({ title: "Помилка", description: err.message, variant: "destructive" });
    },
  });

  const addTarget = () => setTargets([...targets, { target_type: "all", target_id: null }]);
  const removeTarget = (idx: number) => setTargets(targets.filter((_, i) => i !== idx));

  const addCondition = () => setConditions([...conditions, { condition_type: "user_category", operator: "in", value: [] }]);
  const removeCondition = (idx: number) => setConditions(conditions.filter((_, i) => i !== idx));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/discounts")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-3xl font-bold">{isNew ? "Нова скидка" : "Редагування скидки"}</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((d) => save.mutate(d))} className="space-y-6">
          <Tabs defaultValue="main">
            <TabsList>
              <TabsTrigger value="main">Основні</TabsTrigger>
              <TabsTrigger value="targets">Цілі ({targets.length})</TabsTrigger>
              <TabsTrigger value="conditions">Умови ({conditions.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="main">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Назва</FormLabel>
                      <FormControl><Input {...field} placeholder="Знижка 10% для VIP" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Опис</FormLabel>
                      <FormControl><Textarea {...field} /></FormControl>
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="group_id" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Група</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Оберіть" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {groups.map((g: any) => (
                            <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="price_type_id" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Вид ціни</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Оберіть" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {priceTypes.map((pt: any) => (
                            <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="discount_type" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Тип знижки</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="percent">Відсоток (%)</SelectItem>
                            <SelectItem value="fixed_amount">Фіксована сума (грн)</SelectItem>
                            <SelectItem value="fixed_price">Фіксована ціна (= грн)</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="discount_value" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Значення</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={form.control} name="priority" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Пріоритет</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                      </FormControl>
                    </FormItem>
                  )} />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="starts_at" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Дата початку</FormLabel>
                        <FormControl><Input type="datetime-local" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="ends_at" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Дата закінчення</FormLabel>
                        <FormControl><Input type="datetime-local" {...field} /></FormControl>
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={form.control} name="is_active" render={({ field }) => (
                    <FormItem className="flex items-center gap-3">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="!mt-0">Активна</FormLabel>
                    </FormItem>
                  )} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="targets">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>До чого застосовується</CardTitle>
                  <Button type="button" variant="outline" size="sm" onClick={addTarget}>
                    <Plus className="h-4 w-4 mr-1" /> Додати ціль
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {targets.length === 0 && (
                    <p className="text-sm text-muted-foreground">Без цілей — застосовується до всіх товарів</p>
                  )}
                  {targets.map((t, idx) => (
                    <div key={idx} className="flex items-center gap-3 border rounded-md p-3">
                      <Select
                        value={t.target_type}
                        onValueChange={(v) => {
                          const updated = [...targets];
                          updated[idx] = { ...t, target_type: v, target_id: v === "all" ? null : t.target_id };
                          setTargets(updated);
                        }}
                      >
                        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Всі товари</SelectItem>
                          <SelectItem value="product">Товар</SelectItem>
                          <SelectItem value="section">Розділ</SelectItem>
                          <SelectItem value="modification">Модифікація</SelectItem>
                        </SelectContent>
                      </Select>

                      {t.target_type === "product" && (
                        <Select
                          value={t.target_id || ""}
                          onValueChange={(v) => {
                            const updated = [...targets];
                            updated[idx] = { ...t, target_id: v };
                            setTargets(updated);
                          }}
                        >
                          <SelectTrigger className="flex-1"><SelectValue placeholder="Оберіть товар" /></SelectTrigger>
                          <SelectContent>
                            {products.map((p: any) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {t.target_type === "section" && (
                        <Select
                          value={t.target_id || ""}
                          onValueChange={(v) => {
                            const updated = [...targets];
                            updated[idx] = { ...t, target_id: v };
                            setTargets(updated);
                          }}
                        >
                          <SelectTrigger className="flex-1"><SelectValue placeholder="Оберіть розділ" /></SelectTrigger>
                          <SelectContent>
                            {sections.map((s: any) => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {t.target_type === "modification" && (
                        <Input
                          placeholder="UUID модифікації"
                          value={t.target_id || ""}
                          onChange={(e) => {
                            const updated = [...targets];
                            updated[idx] = { ...t, target_id: e.target.value };
                            setTargets(updated);
                          }}
                          className="flex-1"
                        />
                      )}

                      <Button type="button" variant="ghost" size="icon" onClick={() => removeTarget(idx)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="conditions">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Умови застосування</CardTitle>
                  <Button type="button" variant="outline" size="sm" onClick={addCondition}>
                    <Plus className="h-4 w-4 mr-1" /> Додати умову
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {conditions.length === 0 && (
                    <p className="text-sm text-muted-foreground">Без умов — застосовується завжди</p>
                  )}
                  {conditions.map((c, idx) => (
                    <div key={idx} className="flex items-center gap-3 border rounded-md p-3">
                      <Select
                        value={c.condition_type}
                        onValueChange={(v) => {
                          const updated = [...conditions];
                          updated[idx] = { ...c, condition_type: v, operator: v === "user_category" ? "in" : ">=", value: v === "user_logged_in" ? true : v === "user_category" ? [] : 0 };
                          setConditions(updated);
                        }}
                      >
                        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user_category">Категорія користувача</SelectItem>
                          <SelectItem value="min_quantity">Мін. кількість</SelectItem>
                          <SelectItem value="min_order_amount">Мін. сума замовлення</SelectItem>
                          <SelectItem value="user_logged_in">Авторизований</SelectItem>
                        </SelectContent>
                      </Select>

                      {c.condition_type === "user_category" && (
                        <div className="flex-1 flex flex-wrap gap-1">
                          {userCategories.map((uc: any) => {
                            const selected = Array.isArray(c.value) && c.value.includes(uc.id);
                            return (
                              <Badge
                                key={uc.id}
                                variant={selected ? "default" : "outline"}
                                className="cursor-pointer"
                                onClick={() => {
                                  const updated = [...conditions];
                                  const vals = Array.isArray(c.value) ? [...c.value] : [];
                                  if (selected) {
                                    updated[idx] = { ...c, value: vals.filter((v: string) => v !== uc.id) };
                                  } else {
                                    updated[idx] = { ...c, value: [...vals, uc.id] };
                                  }
                                  setConditions(updated);
                                }}
                              >
                                {uc.name}
                              </Badge>
                            );
                          })}
                        </div>
                      )}

                      {(c.condition_type === "min_quantity" || c.condition_type === "min_order_amount") && (
                        <>
                          <Select
                            value={c.operator}
                            onValueChange={(v) => {
                              const updated = [...conditions];
                              updated[idx] = { ...c, operator: v };
                              setConditions(updated);
                            }}
                          >
                            <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value=">=">≥</SelectItem>
                              <SelectItem value=">">{">"}</SelectItem>
                              <SelectItem value="=">=</SelectItem>
                              <SelectItem value="<=">≤</SelectItem>
                              <SelectItem value="<">{"<"}</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            className="w-32"
                            value={c.value}
                            onChange={(e) => {
                              const updated = [...conditions];
                              updated[idx] = { ...c, value: Number(e.target.value) };
                              setConditions(updated);
                            }}
                          />
                        </>
                      )}

                      {c.condition_type === "user_logged_in" && (
                        <Select
                          value={String(c.value)}
                          onValueChange={(v) => {
                            const updated = [...conditions];
                            updated[idx] = { ...c, value: v === "true" };
                            setConditions(updated);
                          }}
                        >
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">Так</SelectItem>
                            <SelectItem value="false">Ні (гість)</SelectItem>
                          </SelectContent>
                        </Select>
                      )}

                      <Button type="button" variant="ghost" size="icon" onClick={() => removeCondition(idx)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex gap-3">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Збереження..." : "Зберегти"}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate("/admin/discounts")}>
              Скасувати
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
