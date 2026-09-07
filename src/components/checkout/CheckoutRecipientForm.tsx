import { useEffect, useState, useMemo } from "react";
import { UseFormReturn } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, ChevronRight, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { RecipientCard } from "./RecipientCard";
import { RecipientSelectorPopup } from "./RecipientSelectorPopup";
import { RecipientSaveDialog } from "./RecipientSaveDialog";

interface CheckoutRecipientFormProps {
  form: UseFormReturn<any>;
}

interface SavedRecipient {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  city: string;
  address: string;
  notes: string | null;
  is_default: boolean;
}

const MAX_VISIBLE_CARDS = 3;

export function CheckoutRecipientForm({ form }: CheckoutRecipientFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const hasDifferentRecipient = form.watch("hasDifferentRecipient");
  const selectedRecipientId = form.watch("savedRecipientId");

  const [popupOpen, setPopupOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [originalRecipient, setOriginalRecipient] = useState<SavedRecipient | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch saved recipients for logged-in users
  const { data: savedRecipients } = useQuery({
    queryKey: ["checkout-saved-recipients", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_recipients")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SavedRecipient[];
    },
    enabled: !!user,
  });

  const visibleRecipients = useMemo(() => {
    if (!savedRecipients) return [];
    return savedRecipients.slice(0, MAX_VISIBLE_CARDS);
  }, [savedRecipients]);

  const showMoreButton = savedRecipients && savedRecipients.length > MAX_VISIBLE_CARDS;

  // Current form values for comparison
  const currentValues = {
    firstName: form.watch("recipientFirstName"),
    lastName: form.watch("recipientLastName"),
    phone: form.watch("recipientPhone"),
    email: form.watch("recipientEmail"),
    city: form.watch("recipientCity"),
    address: form.watch("recipientAddress"),
    notes: form.watch("recipientNotes"),
  };

  // Check for changes when form values change
  useEffect(() => {
    if (!originalRecipient) {
      setHasChanges(false);
      return;
    }
    
    const changed = 
      currentValues.firstName !== originalRecipient.first_name ||
      currentValues.lastName !== originalRecipient.last_name ||
      currentValues.phone !== originalRecipient.phone ||
      (currentValues.email || "") !== (originalRecipient.email || "") ||
      currentValues.city !== originalRecipient.city ||
      currentValues.address !== originalRecipient.address ||
      (currentValues.notes || "") !== (originalRecipient.notes || "");
    
    setHasChanges(changed);
  }, [currentValues, originalRecipient]);

  // Select recipient
  const handleSelectRecipient = (recipientId: string) => {
    if (selectedRecipientId === recipientId) {
      // Deselect
      form.setValue("savedRecipientId", "");
      setOriginalRecipient(null);
      clearRecipientFields();
      return;
    }

    const recipient = savedRecipients?.find((r) => r.id === recipientId);
    if (recipient) {
      form.setValue("savedRecipientId", recipientId);
      setOriginalRecipient(recipient);
      fillRecipientFields(recipient);
    }
  };

  const fillRecipientFields = (recipient: SavedRecipient) => {
    form.setValue("recipientFirstName", recipient.first_name);
    form.setValue("recipientLastName", recipient.last_name);
    form.setValue("recipientPhone", recipient.phone);
    form.setValue("recipientEmail", recipient.email || "");
    form.setValue("recipientCity", recipient.city);
    form.setValue("recipientAddress", recipient.address);
    form.setValue("recipientNotes", recipient.notes || "");
    form.setValue("saveRecipient", false);
  };

  const clearRecipientFields = () => {
    form.setValue("recipientFirstName", "");
    form.setValue("recipientLastName", "");
    form.setValue("recipientPhone", "");
    form.setValue("recipientEmail", "");
    form.setValue("recipientCity", "");
    form.setValue("recipientAddress", "");
    form.setValue("recipientNotes", "");
    form.setValue("saveRecipient", false);
  };

  // Mutation for updating recipient
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!originalRecipient) return;
      const { error } = await supabase
        .from("user_recipients")
        .update({
          first_name: currentValues.firstName,
          last_name: currentValues.lastName,
          phone: currentValues.phone,
          email: currentValues.email || null,
          city: currentValues.city,
          address: currentValues.address,
          notes: currentValues.notes || null,
        })
        .eq("id", originalRecipient.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkout-saved-recipients"] });
      toast({ title: "Отримувача оновлено" });
      setOriginalRecipient({
        ...originalRecipient!,
        first_name: currentValues.firstName,
        last_name: currentValues.lastName,
        phone: currentValues.phone,
        email: currentValues.email || null,
        city: currentValues.city,
        address: currentValues.address,
        notes: currentValues.notes || null,
      });
      setHasChanges(false);
    },
    onError: (error: Error) => {
      toast({ title: "Помилка", description: error.message, variant: "destructive" });
    },
  });

  // Mutation for creating new recipient
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from("user_recipients")
        .insert({
          user_id: user.id,
          first_name: currentValues.firstName,
          last_name: currentValues.lastName,
          phone: currentValues.phone,
          email: currentValues.email || null,
          city: currentValues.city,
          address: currentValues.address,
          notes: currentValues.notes || null,
          is_default: false,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["checkout-saved-recipients"] });
      toast({ title: "Нового отримувача створено" });
      if (data) {
        form.setValue("savedRecipientId", data.id);
        setOriginalRecipient(data as SavedRecipient);
      }
      setHasChanges(false);
    },
    onError: (error: Error) => {
      toast({ title: "Помилка", description: error.message, variant: "destructive" });
    },
  });

  const handleSaveClick = () => {
    if (originalRecipient) {
      // Editing existing - show dialog
      setSaveDialogOpen(true);
    } else if (user) {
      // New recipient for logged-in user - create directly
      createMutation.mutate();
    }
  };

  const handleCancelChanges = () => {
    if (originalRecipient) {
      fillRecipientFields(originalRecipient);
    } else {
      clearRecipientFields();
    }
    setHasChanges(false);
  };

  const handleAddNew = () => {
    form.setValue("savedRecipientId", "");
    setOriginalRecipient(null);
    clearRecipientFields();
    setPopupOpen(false);
  };

  // Clear recipient fields when unchecking "different recipient"
  useEffect(() => {
    if (!hasDifferentRecipient) {
      form.setValue("savedRecipientId", "");
      setOriginalRecipient(null);
      clearRecipientFields();
    }
  }, [hasDifferentRecipient]);

  const isNewRecipient = !selectedRecipientId || selectedRecipientId === "new";

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Отримувач
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Checkbox for different recipient */}
          <FormField
            control={form.control}
            name="hasDifferentRecipient"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="cursor-pointer">
                    Інший отримувач
                  </FormLabel>
                  <p className="text-sm text-muted-foreground">
                    Замовлення отримає інша людина
                  </p>
                </div>
              </FormItem>
            )}
          />

          {/* Recipient form fields - shown only when hasDifferentRecipient is true */}
          {hasDifferentRecipient && (
            <div className="space-y-4 pt-4 border-t">
              {/* Recipient cards for logged-in users */}
              {user && savedRecipients && savedRecipients.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">
                    Збережені отримувачі
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {visibleRecipients.map((recipient) => (
                      <RecipientCard
                        key={recipient.id}
                        id={recipient.id}
                        firstName={recipient.first_name}
                        lastName={recipient.last_name}
                        phone={recipient.phone}
                        city={recipient.city}
                        isSelected={selectedRecipientId === recipient.id}
                        isDefault={recipient.is_default}
                        onClick={() => handleSelectRecipient(recipient.id)}
                      />
                    ))}
                  </div>
                  {showMoreButton && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => setPopupOpen(true)}
                    >
                      Показати всіх ({savedRecipients.length})
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              )}

              {/* Recipient details form */}
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="recipientFirstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ім'я отримувача *</FormLabel>
                      <FormControl>
                        <Input placeholder="Введіть ім'я" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="recipientLastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Прізвище отримувача *</FormLabel>
                      <FormControl>
                        <Input placeholder="Введіть прізвище" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="recipientPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Телефон отримувача *</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="+380" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="recipientEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email отримувача</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="recipientCity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Місто *</FormLabel>
                      <FormControl>
                        <Input placeholder="Введіть місто" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="recipientAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Адреса *</FormLabel>
                      <FormControl>
                        <Input placeholder="вул. Хрещатик, 1, кв. 10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="recipientNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Примітки</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Додаткова інформація про отримувача..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Save changes button for logged-in users */}
              {user && hasChanges && (
                <div className="flex gap-2 p-3 bg-muted/50 rounded-lg">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCancelChanges}
                  >
                    Скасувати
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveClick}
                    disabled={updateMutation.isPending || createMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Зберегти зміни
                  </Button>
                </div>
              )}

              {/* Save recipient checkbox - only for new recipients */}
              {user && isNewRecipient && !hasChanges && currentValues.firstName && (
                <FormField
                  control={form.control}
                  name="saveRecipient"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-muted/50">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="cursor-pointer">
                          Запам'ятати отримувача
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Збереже контакт для наступних замовлень
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recipient selector popup */}
      {savedRecipients && (
        <RecipientSelectorPopup
          open={popupOpen}
          onOpenChange={setPopupOpen}
          recipients={savedRecipients}
          selectedId={selectedRecipientId}
          onSelect={handleSelectRecipient}
          onAddNew={handleAddNew}
        />
      )}

      {/* Save dialog */}
      <RecipientSaveDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        existingRecipientName={originalRecipient ? `${originalRecipient.first_name} ${originalRecipient.last_name}` : undefined}
        onUpdate={() => updateMutation.mutate()}
        onCreate={() => {
          form.setValue("savedRecipientId", "");
          createMutation.mutate();
        }}
        onCancel={handleCancelChanges}
      />
    </>
  );
}
