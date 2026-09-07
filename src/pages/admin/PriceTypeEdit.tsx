import { useEffect } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const schema = z.object({
  name: z.string().min(1, "Назва обов'язкова"),
  code: z.string().min(1, "Код обов'язковий").regex(/^[a-z0-9_]+$/, "Тільки латинські літери, цифри та _"),
  sort_order: z.coerce.number().int().min(0),
  is_default: z.boolean(),
});

type FormData = z.infer<typeof schema>;

export default function PriceTypeEdit() {
  const { priceTypeId } = useParams<{ priceTypeId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  const isNew = location.pathname.endsWith("/new") || !priceTypeId;

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", code: "", sort_order: 0, is_default: false },
  });

  const { data: priceType, isLoading } = useQuery({
    queryKey: ["price-type", priceTypeId],
    queryFn: async () => {
      if (isNew || !priceTypeId) return null;
      const { data, error } = await supabase.from("price_types").select("*").eq("id", priceTypeId).single();
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
        await supabase.from("price_types").update({ is_default: false }).neq("id", priceTypeId || "");
      }
      if (isNew) {
        const { error } = await supabase.from("price_types").insert({
          name: data.name, code: data.code, sort_order: data.sort_order, is_default: data.is_default,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("price_types").update(data).eq("id", priceTypeId!);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-price-types"] });
      queryClient.invalidateQueries({ queryKey: ["price-types"] });
      toast({ title: isNew ? "Вид ціни створено" : "Зміни збережено" });
      navigate("/admin/price-types");
    },
    onError: (error: Error) => {
      toast({ title: "Помилка", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("price_types").delete().eq("id", priceTypeId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-price-types"] });
      toast({ title: "Вид ціни видалено" });
      navigate("/admin/price-types");
    },
    onError: (error: Error) => {
      toast({ title: "Помилка", description: error.message, variant: "destructive" });
    },
  });

  if (!isNew && isLoading) return <div className="p-8 text-center">Завантаження...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/price-types"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <h1 className="text-3xl font-bold">{isNew ? "Новий вид ціни" : "Редагування виду ціни"}</h1>
        </div>
        {!isNew && !priceType?.is_default && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Видалити вид ціни?</AlertDialogTitle>
                <AlertDialogDescription>Ця дія незворотна. Всі ціни цього виду будуть видалені.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Скасувати</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground">Видалити</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>Інформація</CardTitle></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))} className="space-y-6">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Назва</FormLabel><FormControl><Input placeholder="Роздрібна" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="code" render={({ field }) => (
                <FormItem><FormLabel>Код</FormLabel><FormControl><Input placeholder="retail" {...field} /></FormControl>
                <FormDescription>Унікальний код (латиниця, цифри, _)</FormDescription><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="sort_order" render={({ field }) => (
                <FormItem><FormLabel>Порядок сортування</FormLabel><FormControl><Input type="number" min="0" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="is_default" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">За замовчуванням</FormLabel>
                    <FormDescription>Цей вид ціни буде використовуватись як фолбек</FormDescription>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
              <div className="flex justify-end gap-4">
                <Button variant="outline" asChild><Link to="/admin/price-types">Скасувати</Link></Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isNew ? "Створити" : "Зберегти"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
