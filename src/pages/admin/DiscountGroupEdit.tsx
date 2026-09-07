import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const schema = z.object({
  name: z.string().min(1, "Назва обов'язкова"),
  description: z.string().optional(),
  operator: z.enum(["and", "or", "not", "min", "max"]),
  parent_group_id: z.string().optional(),
  is_active: z.boolean(),
  priority: z.number().int(),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function DiscountGroupEdit() {
  const { groupId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !groupId || groupId === "new";

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      operator: "and",
      parent_group_id: searchParams.get("parentId") || "",
      is_active: true,
      priority: 0,
      starts_at: "",
      ends_at: "",
    },
  });

  const { data: parentGroups = [] } = useQuery({
    queryKey: ["discount-groups-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discount_groups")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data.filter((g: any) => g.id !== groupId);
    },
  });

  const { data: existing } = useQuery({
    queryKey: ["discount-group", groupId],
    queryFn: async () => {
      if (isNew) return null;
      const { data, error } = await supabase
        .from("discount_groups")
        .select("*")
        .eq("id", groupId!)
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
        description: existing.description || "",
        operator: existing.operator as any,
        parent_group_id: existing.parent_group_id || "",
        is_active: existing.is_active,
        priority: existing.priority,
        starts_at: existing.starts_at ? existing.starts_at.slice(0, 16) : "",
        ends_at: existing.ends_at ? existing.ends_at.slice(0, 16) : "",
      });
    }
  }, [existing, form]);

  const save = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        name: data.name,
        description: data.description || null,
        operator: data.operator,
        parent_group_id: data.parent_group_id && data.parent_group_id !== "__root__" ? data.parent_group_id : null,
        is_active: data.is_active,
        priority: data.priority,
        starts_at: data.starts_at || null,
        ends_at: data.ends_at || null,
      };

      if (isNew) {
        const { error } = await supabase.from("discount_groups").insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("discount_groups").update(payload).eq("id", groupId!);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discount-groups-tree"] });
      toast({ title: isNew ? "Групу створено" : "Групу оновлено" });
      navigate("/admin/discounts");
    },
    onError: (err: any) => {
      toast({ title: "Помилка", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/discounts")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-3xl font-bold">{isNew ? "Нова група скидок" : "Редагування групи"}</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((d) => save.mutate(d))} className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Основні дані</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Назва</FormLabel>
                  <FormControl><Input {...field} placeholder="Літній розпродаж" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Опис</FormLabel>
                  <FormControl><Textarea {...field} /></FormControl>
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="operator" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Оператор групи</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="and">ТА — сумувати скидки</SelectItem>
                        <SelectItem value="or">АБО — перша підходяща</SelectItem>
                        <SelectItem value="not">НЕ — інвертувати</SelectItem>
                        <SelectItem value="min">МІН — найменша</SelectItem>
                        <SelectItem value="max">МАКС — найбільша</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

              </div>

              <FormField control={form.control} name="parent_group_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Батьківська група (необов'язково)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || "__root__"}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Кореневий рівень" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="__root__">Кореневий рівень</SelectItem>
                      {parentGroups.map((g: any) => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />

              <FormField control={form.control} name="priority" render={({ field }) => (
                <FormItem>
                  <FormLabel>Пріоритет (менше = вище)</FormLabel>
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
