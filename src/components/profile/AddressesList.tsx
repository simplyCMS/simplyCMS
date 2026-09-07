import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Pencil, Trash2, MapPin, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const addressSchema = z.object({
  name: z.string().min(1, "Назва обов'язкова"),
  city: z.string().min(1, "Місто обов'язкове"),
  address: z.string().min(1, "Адреса обов'язкова"),
  is_default: z.boolean(),
});

type AddressFormData = z.infer<typeof addressSchema>;

interface Address {
  id: string;
  name: string;
  city: string;
  address: string;
  is_default: boolean;
  usage_count?: number;
}

export function AddressesList() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<Address | null>(null);

  const form = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      name: "",
      city: "",
      address: "",
      is_default: false,
    },
  });

  // Fetch addresses with usage count
  const { data: addresses, isLoading } = useQuery({
    queryKey: ["user-addresses", user?.id],
    queryFn: async () => {
      // First get addresses
      const { data: addressData, error: addressError } = await supabase
        .from("user_addresses")
        .select("*")
        .eq("user_id", user!.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (addressError) throw addressError;

      // Then count usage for each address
      const addressesWithCount = await Promise.all(
        (addressData || []).map(async (addr) => {
          const { count } = await supabase
            .from("orders")
            .select("*", { count: "exact", head: true })
            .eq("saved_address_id", addr.id);
          return { ...addr, usage_count: count || 0 };
        })
      );

      return addressesWithCount as Address[];
    },
    enabled: !!user,
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: AddressFormData) => {
      if (data.is_default) {
        await supabase
          .from("user_addresses")
          .update({ is_default: false })
          .eq("user_id", user!.id);
      }

      if (editingAddress) {
        const { error } = await supabase
          .from("user_addresses")
          .update(data)
          .eq("id", editingAddress.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_addresses")
          .insert([{ 
            name: data.name, 
            city: data.city, 
            address: data.address, 
            is_default: data.is_default, 
            user_id: user!.id 
          }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-addresses"] });
      setDialogOpen(false);
      setEditingAddress(null);
      form.reset();
      toast({ title: editingAddress ? "Адресу оновлено" : "Адресу додано" });
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
        .from("user_addresses")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-addresses"] });
      toast({ title: "Адресу видалено" });
      setDeleteDialogOpen(false);
      setAddressToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const openEditDialog = (address: Address) => {
    setEditingAddress(address);
    form.reset({
      name: address.name,
      city: address.city,
      address: address.address,
      is_default: address.is_default,
    });
    setDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingAddress(null);
    form.reset({
      name: "",
      city: "",
      address: "",
      is_default: addresses?.length === 0,
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (address: Address) => {
    setAddressToDelete(address);
    setDeleteDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Адреси доставки
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
            <MapPin className="h-5 w-5" />
            Адреси доставки
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNewDialog}>
                <Plus className="h-4 w-4 mr-1" />
                Додати
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingAddress ? "Редагування адреси" : "Нова адреса"}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Назва</FormLabel>
                        <FormControl>
                          <Input placeholder="Дім, Робота..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Місто</FormLabel>
                        <FormControl>
                          <Input placeholder="Київ" {...field} />
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
                          <Input placeholder="вул. Хрещатик, 1, кв. 1" {...field} />
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
                        <FormLabel className="font-normal">За замовчуванням</FormLabel>
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
                      {editingAddress ? "Зберегти" : "Додати"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {addresses?.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Ви ще не додали жодної адреси
            </p>
          ) : (
            <div className="space-y-3">
              {addresses?.map((addr) => (
                <div
                  key={addr.id}
                  className="flex items-start justify-between p-3 border rounded-lg"
                >
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {addr.name}
                      {addr.is_default && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          За замовчуванням
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      м. {addr.city}, {addr.address}
                    </p>
                    {addr.usage_count !== undefined && addr.usage_count > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Використано в {addr.usage_count} замовленнях
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(addr)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDeleteDialog(addr)}
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
              Видалити адресу "{addressToDelete?.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              {addressToDelete?.usage_count && addressToDelete.usage_count > 0 ? (
                <>
                  <p>
                    Ця адреса використовується в {addressToDelete.usage_count} замовленнях.
                  </p>
                  <p className="text-foreground font-medium">
                    Дані адреси в замовленнях збережуться.
                  </p>
                </>
              ) : (
                <p>Ви впевнені, що хочете видалити цю адресу?</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => addressToDelete && deleteMutation.mutate(addressToDelete.id)}
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
