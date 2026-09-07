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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Truck, ChevronRight, Save, icons } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ShippingMethod, ShippingRate, PickupPoint } from "@/lib/shipping/types";
import { formatShippingCost } from "@/lib/shipping";
import { PluginSlot } from "@/components/plugins/PluginSlot";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { AddressCard } from "./AddressCard";
import { AddressSelectorPopup } from "./AddressSelectorPopup";
import { AddressSaveDialog } from "./AddressSaveDialog";

interface CheckoutDeliveryFormProps {
  form: UseFormReturn<any>;
  subtotal: number;
  onShippingCostChange: (cost: number) => void;
}

interface SavedAddress {
  id: string;
  name: string;
  city: string;
  address: string;
  is_default: boolean;
}

const MAX_VISIBLE_CARDS = 3;

const getMethodIcon = (iconName: string | null): React.ComponentType<{ className?: string }> => {
  if (!iconName) return Truck;
  const Icon = icons[iconName as keyof typeof icons];
  return Icon || Truck;
};

export function CheckoutDeliveryForm({ form, subtotal, onShippingCostChange }: CheckoutDeliveryFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const selectedMethodId = form.watch("shippingMethodId");
  const selectedPickupPointId = form.watch("pickupPointId");
  const selectedAddressId = form.watch("savedAddressId");

  const [popupOpen, setPopupOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [originalAddress, setOriginalAddress] = useState<SavedAddress | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch active shipping methods
  const { data: methods, isLoading: methodsLoading } = useQuery({
    queryKey: ["checkout-shipping-methods"],
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

  // Fetch rates for default zone
  const { data: rates } = useQuery({
    queryKey: ["checkout-shipping-rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_rates")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as unknown as ShippingRate[];
    },
  });

  // Fetch pickup points
  const { data: pickupPoints } = useQuery({
    queryKey: ["checkout-pickup-points"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pickup_points")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as unknown as PickupPoint[];
    },
  });

  // Fetch saved addresses for logged-in users
  const { data: savedAddresses } = useQuery({
    queryKey: ["checkout-saved-addresses", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SavedAddress[];
    },
    enabled: !!user,
  });

  const visibleAddresses = useMemo(() => {
    if (!savedAddresses) return [];
    return savedAddresses.slice(0, MAX_VISIBLE_CARDS);
  }, [savedAddresses]);

  const showMoreButton = savedAddresses && savedAddresses.length > MAX_VISIBLE_CARDS;

  const selectedMethod = methods?.find((m) => m.id === selectedMethodId);
  const isPickup = selectedMethod?.code === "pickup";
  const showAddressFields = selectedMethod && !isPickup;

  // Current form values for comparison
  const currentCity = form.watch("deliveryCity");
  const currentAddress = form.watch("deliveryAddress");

  // Check for changes
  useEffect(() => {
    if (!originalAddress) {
      setHasChanges(false);
      return;
    }
    
    const changed = 
      currentCity !== originalAddress.city ||
      currentAddress !== originalAddress.address;
    
    setHasChanges(changed);
  }, [currentCity, currentAddress, originalAddress]);

  // Select address
  const handleSelectAddress = (addressId: string) => {
    if (selectedAddressId === addressId) {
      // Deselect
      form.setValue("savedAddressId", "");
      setOriginalAddress(null);
      form.setValue("deliveryCity", "");
      form.setValue("deliveryAddress", "");
      return;
    }

    const address = savedAddresses?.find((a) => a.id === addressId);
    if (address) {
      form.setValue("savedAddressId", addressId);
      setOriginalAddress(address);
      form.setValue("deliveryCity", address.city);
      form.setValue("deliveryAddress", address.address);
    }
  };

  // Mutation for updating address
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!originalAddress) return;
      const { error } = await supabase
        .from("user_addresses")
        .update({
          city: currentCity,
          address: currentAddress,
        })
        .eq("id", originalAddress.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkout-saved-addresses"] });
      toast({ title: "Адресу оновлено" });
      setOriginalAddress({
        ...originalAddress!,
        city: currentCity,
        address: currentAddress,
      });
      setHasChanges(false);
    },
    onError: (error: Error) => {
      toast({ title: "Помилка", description: error.message, variant: "destructive" });
    },
  });

  // Mutation for creating new address
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from("user_addresses")
        .insert({
          user_id: user.id,
          name: "Нова адреса",
          city: currentCity,
          address: currentAddress,
          is_default: false,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["checkout-saved-addresses"] });
      toast({ title: "Нову адресу створено" });
      if (data) {
        form.setValue("savedAddressId", data.id);
        setOriginalAddress(data as SavedAddress);
      }
      setHasChanges(false);
    },
    onError: (error: Error) => {
      toast({ title: "Помилка", description: error.message, variant: "destructive" });
    },
  });

  const handleSaveClick = () => {
    if (originalAddress) {
      setSaveDialogOpen(true);
    } else if (user) {
      createMutation.mutate();
    }
  };

  const handleCancelChanges = () => {
    if (originalAddress) {
      form.setValue("deliveryCity", originalAddress.city);
      form.setValue("deliveryAddress", originalAddress.address);
    } else {
      form.setValue("deliveryCity", "");
      form.setValue("deliveryAddress", "");
    }
    setHasChanges(false);
  };

  const handleAddNew = () => {
    form.setValue("savedAddressId", "");
    setOriginalAddress(null);
    form.setValue("deliveryCity", "");
    form.setValue("deliveryAddress", "");
    setPopupOpen(false);
  };

  // Calculate shipping cost when method changes
  useEffect(() => {
    if (!selectedMethodId || !rates) {
      onShippingCostChange(0);
      return;
    }

    const methodRates = rates.filter((r) => r.method_id === selectedMethodId);
    if (methodRates.length === 0) {
      onShippingCostChange(0);
      return;
    }

    const rate = methodRates[0];
    let cost = rate.base_cost;

    switch (rate.calculation_type) {
      case "flat":
        cost = rate.base_cost;
        break;
      case "free_from":
        if (rate.free_from_amount && subtotal >= rate.free_from_amount) {
          cost = 0;
        } else {
          cost = rate.base_cost;
        }
        break;
      default:
        cost = rate.base_cost;
    }

    onShippingCostChange(cost);
  }, [selectedMethodId, rates, subtotal, onShippingCostChange]);

  // Set default method when loaded
  useEffect(() => {
    if (methods && methods.length > 0 && !selectedMethodId) {
      form.setValue("shippingMethodId", methods[0].id);
    }
  }, [methods, selectedMethodId, form]);

  // Get rate info for display
  const getRateInfo = (methodId: string) => {
    if (!rates) return null;
    const methodRates = rates.filter((r) => r.method_id === methodId);
    if (methodRates.length === 0) return null;
    const rate = methodRates[0];
    
    let displayCost = rate.base_cost;
    if (rate.calculation_type === "free_from" && rate.free_from_amount && subtotal >= rate.free_from_amount) {
      displayCost = 0;
    }
    
    return {
      cost: displayCost,
      estimatedDays: rate.estimated_days,
    };
  };

  if (methodsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Спосіб доставки
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Спосіб доставки
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            control={form.control}
            name="shippingMethodId"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="grid gap-3"
                  >
                    {methods?.map((method) => {
                      const IconComponent = getMethodIcon(method.icon);
                      const rateInfo = getRateInfo(method.id);
                      
                      return (
                        <div key={method.id}>
                          <RadioGroupItem
                            value={method.id}
                            id={method.id}
                            className="peer sr-only"
                          />
                          <Label
                            htmlFor={method.id}
                            className="flex items-center gap-4 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-colors"
                          >
                            <IconComponent className="h-5 w-5 text-muted-foreground" />
                            <div className="flex-1">
                              <div className="font-medium">{method.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {method.description}
                              </div>
                              {rateInfo?.estimatedDays && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {rateInfo.estimatedDays}
                                </div>
                              )}
                            </div>
                            <div className="font-medium text-right">
                              {rateInfo ? formatShippingCost(rateInfo.cost) : "—"}
                            </div>
                          </Label>
                        </div>
                      );
                    })}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <PluginSlot 
            name="checkout.shipping.methods" 
            context={{ 
              cart: { subtotal },
              selectedMethodId,
            }} 
          />

          {/* Pickup points selector */}
          {isPickup && pickupPoints && pickupPoints.length > 0 && (
            <div className="pt-4 border-t">
              <FormField
                control={form.control}
                name="pickupPointId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Оберіть пункт самовивозу *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Оберіть пункт" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {pickupPoints.map((point) => (
                          <SelectItem key={point.id} value={point.id}>
                            <div>
                              <div className="font-medium">{point.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {point.city}, {point.address}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {/* Address fields for delivery */}
          {showAddressFields && (
            <div className="space-y-4 pt-4 border-t">
              {/* Address cards for logged-in users */}
              {user && savedAddresses && savedAddresses.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">
                    Збережені адреси
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {visibleAddresses.map((address) => (
                      <AddressCard
                        key={address.id}
                        id={address.id}
                        name={address.name}
                        city={address.city}
                        address={address.address}
                        isSelected={selectedAddressId === address.id}
                        isDefault={address.is_default}
                        onClick={() => handleSelectAddress(address.id)}
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
                      Показати всі ({savedAddresses.length})
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              )}

              <FormField
                control={form.control}
                name="deliveryCity"
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
                name="deliveryAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Адреса доставки *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="вул. Хрещатик, 1, кв. 10"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Save changes button */}
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
                    Зберегти адресу
                  </Button>
                </div>
              )}
            </div>
          )}

          <PluginSlot 
            name="checkout.shipping.form" 
            context={{ 
              method: selectedMethod,
              form,
            }} 
          />
        </CardContent>
      </Card>

      {/* Address selector popup */}
      {savedAddresses && (
        <AddressSelectorPopup
          open={popupOpen}
          onOpenChange={setPopupOpen}
          addresses={savedAddresses}
          selectedId={selectedAddressId}
          onSelect={handleSelectAddress}
          onAddNew={handleAddNew}
        />
      )}

      {/* Save dialog */}
      <AddressSaveDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        existingAddressName={originalAddress?.name}
        onUpdate={() => updateMutation.mutate()}
        onCreate={() => {
          form.setValue("savedAddressId", "");
          createMutation.mutate();
        }}
        onCancel={handleCancelChanges}
      />
    </>
  );
}
