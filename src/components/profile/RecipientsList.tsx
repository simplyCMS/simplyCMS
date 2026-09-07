import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Users, Loader2, AlertTriangle, Phone, Mail, MapPin } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const recipientSchema = z.object({
  first_name: z.string().min(1, "Ім'я обов'язкове"),
  last_name: z.string().min(1, "Прізвище обов'язкове"),
  phone: z.string().min(10, "Введіть коректний номер"),
  email: z.string().email().optional().or(z.literal("")),
  city: z.string().min(1, "Місто обов'язкове"),
  address: z.string().min(1, "Адреса обов'язкова"),
  notes: z.string().optional(),
  is_default: z.boolean(),
});

type RecipientFormData = z.infer<typeof recipientSchema>;

interface Recipient {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  city: string;
  address: string;
  notes: string | null;
  is_default: boolean;
  usage_count?: number;
}

export function RecipientsList() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recipientToDelete, setRecipientToDelete] = useState<Recipient | null>(null);

  const form = useForm<RecipientFormData>({
    resolver: zodResolver(recipientSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      phone: "",
      email: "",
      city: "",
      address: "",
      notes: "",
      is_default: false,
    },
  });

  // Fetch recipients with usage count
  const { data: recipients, isLoading } = useQuery({
    queryKey: ["user-recipients", user?.id],
    queryFn: async () => {
      // First get recipients
      const { data: recipientData, error: recipientError } = await supabase
        .from("user_recipients")
        .select("*")
        .eq("user_id", user!.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (recipientError) throw recipientError;

      // Then count usage for each recipient
      const recipientsWithCount = await Promise.all(
        (recipientData || []).map(async (r) => {
          const { count } = await supabase
            .from("orders")
            .select("*", { count: "exact", head: true })
            .eq("saved_recipient_id", r.id);
          return { ...r, usage_count: count || 0 };
        })
      );

      return recipientsWithCount as Recipient[];
    },
    enabled: !!user,
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: RecipientFormData) => {
      if (data.is_default) {
        await supabase
          .from("user_recipients")
          .update({ is_default: false })
          .eq("user_id", user!.id);
      }

      const payload = {
        ...data,
        email: data.email || null,
        notes: data.notes || null,
      };

      if (editingRecipient) {
        const { error } = await supabase
          .from("user_recipients")
          .update(payload)
          .eq("id", editingRecipient.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_recipients")
          .insert([{
            first_name: data.first_name,
            last_name: data.last_name,
            phone: data.phone,
            email: data.email || null,
            city: data.city,
            address: data.address,
            notes: data.notes || null,
            is_default: data.is_default,
            user_id: user!.id,
          }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-recipients"] });
      setDialogOpen(false);
      setEditingRecipient(null);
      form.reset();
      toast({ title: editingRecipient ? "Отримувача оновлено" : "Отримувача додано" });
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
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_recipients")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-recipients"] });
      toast({ title: "Отримувача видалено" });
      setDeleteDialogOpen(false);
      setRecipientToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const openEditDialog = (recipient: Recipient) => {
    setEditingRecipient(recipient);
    form.reset({
      first_name: recipient.first_name,
      last_name: recipient.last_name,
      phone: recipient.phone,
      email: recipient.email || "",
      city: recipient.city,
      address: recipient.address,
      notes: recipient.notes || "",
      is_default: recipient.is_default,
    });
    setDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingRecipient(null);
    form.reset({
      first_name: "",
      last_name: "",
      phone: "",
      email: "",
      city: "",
      address: "",
      notes: "",
      is_default: recipients?.length === 0,
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (recipient: Recipient) => {
    setRecipientToDelete(recipient);
    setDeleteDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Отримувачі
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            Завантаження...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Отримувачі
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNewDialog}>
                <Plus className="h-4 w-4 mr-1" />
                Додати
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingRecipient ? "Редагування отримувача" : "Новий отримувач"}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))}
                  className="space-y-4"
                >
                  <div className="grid sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="first_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ім'я</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="last_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Прізвище</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Телефон</FormLabel>
                          <FormControl>
                            <Input type="tel" placeholder="+380..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email (необов'язково)</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Місто</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Адреса</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Нотатки</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Наприклад: Мама, колега..."
                            rows={2}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="is_default"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel className="font-normal">
                          Основний отримувач
                        </FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                    >
                      Скасувати
                    </Button>
                    <Button type="submit" disabled={saveMutation.isPending}>
                      {saveMutation.isPending && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      {editingRecipient ? "Зберегти" : "Додати"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {recipients?.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Ви ще не додали жодного отримувача
            </p>
          ) : (
            <div className="grid gap-3">
              {recipients?.map((r) => (
                <div
                  key={r.id}
                  className="flex items-start justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="font-medium flex items-center gap-2">
                      {r.first_name} {r.last_name}
                      {r.is_default && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          Основний
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {r.phone}
                      </span>
                      {r.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {r.email}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      м. {r.city}, {r.address}
                    </p>
                    {r.notes && (
                      <p className="text-xs text-muted-foreground italic">
                        {r.notes}
                      </p>
                    )}
                    {r.usage_count !== undefined && r.usage_count > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Використано в {r.usage_count} замовленнях
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(r)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDeleteDialog(r)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Видалити отримувача "{recipientToDelete?.first_name} {recipientToDelete?.last_name}"?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              {recipientToDelete?.usage_count && recipientToDelete.usage_count > 0 ? (
                <>
                  <p>
                    Цей контакт використовується в {recipientToDelete.usage_count} замовленнях.
                  </p>
                  <p className="text-foreground font-medium">
                    Дані отримувача в замовленнях збережуться.
                  </p>
                </>
              ) : (
                <p>Ви впевнені, що хочете видалити цього отримувача?</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => recipientToDelete && deleteMutation.mutate(recipientToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Видалити
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
