import { useEffect } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Loader2, Trash2, Plus, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const conditionFields = [
  { value: "total_purchases", label: "Сума покупок (грн)" },
  { value: "registration_days", label: "Днів з реєстрації" },
  { value: "orders_count", label: "Кількість замовлень" },
  { value: "email_domain", label: "Домен email" },
  { value: "auth_provider", label: "Провайдер авторизації" },
  { value: "utm_source", label: "UTM Source" },
  { value: "utm_campaign", label: "UTM Campaign" },
];

const numericOperators = [
  { value: ">=", label: ">=" },
  { value: ">", label: ">" },
  { value: "<=", label: "<=" },
  { value: "<", label: "<" },
  { value: "=", label: "=" },
];

const stringOperators = [
  { value: "=", label: "дорівнює" },
  { value: "contains", label: "містить" },
];

const ruleSchema = z.object({
  name: z.string().min(1, "Назва обов'язкова"),
  description: z.string().optional(),
  from_category_id: z.string().nullable(),
  to_category_id: z.string().min(1, "Оберіть категорію призначення"),
  priority: z.coerce.number().int().min(0),
  is_active: z.boolean(),
  conditions: z.object({
    type: z.enum(["all", "any"]),
    rules: z.array(
      z.object({
        field: z.string().min(1),
        operator: z.string().min(1),
        value: z.string().min(1),
      })
    ),
  }),
});

type RuleFormData = z.infer<typeof ruleSchema>;

export default function UserCategoryRuleEdit() {
  const { ruleId } = useParams<{ ruleId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  const isNew = location.pathname.endsWith("/new") || !ruleId;

  const form = useForm<RuleFormData>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      name: "",
      description: "",
      from_category_id: null,
      to_category_id: "",
      priority: 0,
      is_active: true,
      conditions: {
        type: "all",
        rules: [],
      },
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "conditions.rules",
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ["user-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch rule
  const { data: rule, isLoading } = useQuery({
    queryKey: ["category-rule", ruleId],
    queryFn: async () => {
      if (isNew || !ruleId) return null;
      const { data, error } = await supabase
        .from("category_rules")
        .select("*")
        .eq("id", ruleId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !isNew && !!ruleId,
  });

  // Fill form when rule loads
  useEffect(() => {
    if (rule) {
      const conditions = rule.conditions as { type: "all" | "any"; rules: Array<{ field: string; operator: string; value: string }> };
      form.reset({
        name: rule.name,
        description: rule.description || "",
        from_category_id: rule.from_category_id,
        to_category_id: rule.to_category_id,
        priority: rule.priority,
        is_active: rule.is_active,
        conditions: {
          type: conditions?.type || "all",
          rules: conditions?.rules?.map((r) => ({
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
        const { error } = await supabase.from("category_rules").insert(payload);
        if (error) throw error;
      } else {
        if (!ruleId) throw new Error("Rule ID is required for update");
        const { error } = await supabase
          .from("category_rules")
          .update(payload)
          .eq("id", ruleId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-rules"] });
      queryClient.invalidateQueries({ queryKey: ["user-categories"] });
      toast({ title: isNew ? "Правило створено" : "Зміни збережено" });
      navigate("/admin/user-categories/rules");
    },
    onError: (error: Error) => {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!ruleId) throw new Error("Rule ID is required for delete");
      const { error } = await supabase
        .from("category_rules")
        .delete()
        .eq("id", ruleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-rules"] });
      queryClient.invalidateQueries({ queryKey: ["user-categories"] });
      toast({ title: "Правило видалено" });
      navigate("/admin/user-categories/rules");
    },
    onError: (error: Error) => {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isNumericField = (field: string) => {
    return ["total_purchases", "registration_days", "orders_count"].includes(field);
  };

  if (!isNew && isLoading) {
    return <div className="p-8 text-center">Завантаження...</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/user-categories/rules">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">
            {isNew ? "Нове правило" : "Редагування правила"}
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
                <AlertDialogTitle>Видалити правило?</AlertDialogTitle>
                <AlertDialogDescription>
                  Ця дія незворотна.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Скасувати</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate()}
                  className="bg-destructive text-destructive-foreground"
                >
                  Видалити
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
              <CardTitle>Основна інформація</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Назва правила</FormLabel>
                    <FormControl>
                      <Input placeholder="VIP за сумою покупок" {...field} />
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
                      <Textarea placeholder="Опис правила..." {...field} />
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
                      <FormLabel>Пріоритет</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormDescription>
                        Вищий пріоритет виконується першим
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
                        <FormLabel>Активне</FormLabel>
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
              <CardTitle>Перехід між категоріями</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="from_category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>З категорії</FormLabel>
                      <Select
                        value={field.value || "any"}
                        onValueChange={(v) =>
                          field.onChange(v === "any" ? null : v)
                        }
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Будь-яка" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="any">Будь-яка категорія</SelectItem>
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
                      <FormLabel>До категорії</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Оберіть категорію" />
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
              <CardTitle>Умови</CardTitle>
              <FormField
                control={form.control}
                name="conditions.type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Всі умови (AND)</SelectItem>
                      <SelectItem value="any">Будь-яка умова (OR)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  Додайте хоча б одну умову
                </p>
              )}

              {fields.map((item, index) => {
                const fieldValue = form.watch(`conditions.rules.${index}.field`);
                const operators = isNumericField(fieldValue)
                  ? numericOperators
                  : stringOperators;

                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-2 p-4 border rounded-lg"
                  >
                    <FormField
                      control={form.control}
                      name={`conditions.rules.${index}.field`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <Select
                            value={field.value}
                            onValueChange={(v) => {
                              field.onChange(v);
                              // Reset operator when field changes
                              form.setValue(
                                `conditions.rules.${index}.operator`,
                                isNumericField(v) ? ">=" : "="
                              );
                            }}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Поле" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {conditionFields.map((f) => (
                                <SelectItem key={f.value} value={f.value}>
                                  {f.label}
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
                      name={`conditions.rules.${index}.operator`}
                      render={({ field }) => (
                        <FormItem className="w-32">
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Оператор" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {operators.map((op) => (
                                <SelectItem key={op.value} value={op.value}>
                                  {op.label}
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
                      name={`conditions.rules.${index}.value`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input
                              type={isNumericField(fieldValue) ? "number" : "text"}
                              placeholder="Значення"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}

              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  append({ field: "total_purchases", operator: ">=", value: "" })
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                Додати умову
              </Button>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button variant="outline" asChild>
              <Link to="/admin/user-categories/rules">Скасувати</Link>
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isNew ? "Створити" : "Зберегти"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
